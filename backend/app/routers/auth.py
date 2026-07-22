from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import timedelta

from .. import schemas, models, crud, auth, database
from ..deps import get_current_user, get_current_tenant

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", response_model=schemas.UserResponse)
async def signup(user: schemas.UserCreate, db: AsyncSession = Depends(database.get_db)):
    db_user = await crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return await crud.create_user(db=db, user=user)

@router.post("/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(database.get_db)):
    user = await crud.get_user_by_email(db, email=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserResponse)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.get("/memberships")
async def get_user_memberships(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    # Query agency memberships
    agency_res = await db.execute(
        select(models.AgencyMembership)
        .where(models.AgencyMembership.user_id == current_user.id)
    )
    agency_memberships = agency_res.scalars().all()
    
    agencies_list = []
    for am in agency_memberships:
        # Get agency name
        agency_q = await db.execute(select(models.Agency).where(models.Agency.id == am.agency_id))
        agency = agency_q.scalar_one_or_none()
        if agency:
            agencies_list.append({
                "agency_id": agency.id,
                "agency_name": agency.name,
                "role": am.role,
                "client_id": None
            })
            
    # Query client memberships
    client_res = await db.execute(
        select(models.ClientMembership)
        .where(models.ClientMembership.user_id == current_user.id)
    )
    client_memberships = client_res.scalars().all()
    
    for cm in client_memberships:
        # Get client details
        client_q = await db.execute(select(models.Client).where(models.Client.id == cm.client_id))
        client = client_q.scalar_one_or_none()
        if client:
            # Get agency
            agency_q = await db.execute(select(models.Agency).where(models.Agency.id == client.agency_id))
            agency = agency_q.scalar_one_or_none()
            if agency:
                agencies_list.append({
                    "agency_id": agency.id,
                    "agency_name": f"{agency.name} (as Client: {client.name})",
                    "role": "client_user",
                    "client_id": client.id
                })
                
    return agencies_list

@router.get("/agency-users")
async def list_agency_users(
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    if tenant_ctx["role"] == models.Role.client_user:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.execute(
        select(models.User)
        .join(models.AgencyMembership)
        .where(models.AgencyMembership.agency_id == tenant_ctx["agency_id"])
    )
    users = result.scalars().all()
    return [{"id": u.id, "email": u.email, "full_name": u.full_name} for u in users]
