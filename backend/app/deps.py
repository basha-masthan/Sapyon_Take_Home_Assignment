from fastapi import Depends, HTTPException, status, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import Optional
from jose import JWTError, jwt

from .database import get_db
from .models import User, AgencyMembership, Role, ClientMembership, Agency, Client
from .auth import oauth2_scheme, SECRET_KEY, ALGORITHM
from .schemas import TokenData

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=int(user_id))
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

async def get_current_tenant(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    agency_id = request.headers.get("X-Agency-ID")
    if not agency_id:
        raise HTTPException(status_code=400, detail="X-Agency-ID header missing")
    
    try:
        agency_id = int(agency_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid X-Agency-ID format")
    
    # Check agency membership
    result = await db.execute(
        select(AgencyMembership)
        .where(AgencyMembership.user_id == current_user.id)
        .where(AgencyMembership.agency_id == agency_id)
    )
    agency_membership = result.scalar_one_or_none()
    
    # Check client membership if no agency membership
    client_membership = None
    if not agency_membership:
        result = await db.execute(
            select(ClientMembership)
            .join(Client)
            .where(ClientMembership.user_id == current_user.id)
            .where(Client.agency_id == agency_id)
        )
        client_membership = result.scalar_one_or_none()

    if not agency_membership and not client_membership:
        raise HTTPException(status_code=403, detail="Not a member of this agency context")

    role = agency_membership.role if agency_membership else Role.client_user
    
    return {
        "user": current_user,
        "agency_id": agency_id,
        "role": role,
        "client_id": client_membership.client_id if client_membership else None
    }
