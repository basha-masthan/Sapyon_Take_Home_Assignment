from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from .. import schemas, models, database
from ..deps import get_current_tenant

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("/", response_model=List[schemas.ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    agency_id = tenant_ctx["agency_id"]
    role = tenant_ctx["role"]
    user = tenant_ctx["user"]
    
    query = select(models.Project).where(models.Project.agency_id == agency_id)
    
    if role == models.Role.client_user:
        client_id = tenant_ctx["client_id"]
        if not client_id:
            return []
        query = query.where(models.Project.client_id == client_id)
    elif role == models.Role.agency_member:
        query = query.join(models.ProjectMember).where(models.ProjectMember.user_id == user.id)
        
    result = await db.execute(query)
    projects = result.scalars().all()
    return projects

@router.get("/{project_id}", response_model=schemas.ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    projects = await list_projects(db, tenant_ctx)
    for p in projects:
        if p.id == project_id:
            return p
    raise HTTPException(status_code=404, detail="Project not found")

@router.get("/{project_id}/dashboard")
async def get_project_dashboard(
    project_id: int,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    # Query tasks
    task_query = select(models.Task).where(models.Task.project_id == project_id)
    if tenant_ctx["role"] == models.Role.client_user:
        task_query = task_query.where(models.Task.is_internal == False)
    
    task_result = await db.execute(task_query)
    tasks = task_result.scalars().all()
    
    task_ids = [t.id for t in tasks]
    
    # Compute counts
    counts = {"todo": 0, "in_progress": 0, "done": 0}
    for t in tasks:
        status = t.status.lower() if t.status else "todo"
        if status in counts:
            counts[status] += 1
            
    # Compute logged hours
    total_minutes = 0
    if task_ids:
        time_query = select(models.TimeEntry).where(models.TimeEntry.task_id.in_(task_ids))
        time_result = await db.execute(time_query)
        time_entries = time_result.scalars().all()
        total_minutes = sum(te.duration_minutes for te in time_entries)
        
    return {
        "task_counts": counts,
        "hours_logged": round(total_minutes / 60, 2)
    }

# Project Members Endpoints
@router.get("/{project_id}/members")
async def list_project_members(
    project_id: int,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    # We query the project members and their usernames/emails
    result = await db.execute(
        select(models.User)
        .join(models.ProjectMember)
        .where(models.ProjectMember.project_id == project_id)
    )
    members = result.scalars().all()
    return [{"id": m.id, "email": m.email, "full_name": m.full_name} for m in members]

@router.post("/{project_id}/members")
async def add_project_member(
    project_id: int,
    user_id: int,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    if tenant_ctx["role"] != models.Role.agency_admin:
        raise HTTPException(status_code=403, detail="Only agency admins can manage project members")
        
    await get_project(project_id, db, tenant_ctx)
    
    # Verify user exists and is a member of the agency
    check_membership = await db.execute(
        select(models.AgencyMembership)
        .where(models.AgencyMembership.user_id == user_id, models.AgencyMembership.agency_id == tenant_ctx["agency_id"])
    )
    if not check_membership.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is not a member of this agency")
        
    # Check if already added
    check_proj_member = await db.execute(
        select(models.ProjectMember)
        .where(models.ProjectMember.project_id == project_id, models.ProjectMember.user_id == user_id)
    )
    if check_proj_member.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member of this project")
        
    db_member = models.ProjectMember(project_id=project_id, user_id=user_id)
    db.add(db_member)
    await db.commit()
    return {"message": "Member added successfully"}

@router.delete("/{project_id}/members/{user_id}")
async def remove_project_member(
    project_id: int,
    user_id: int,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    if tenant_ctx["role"] != models.Role.agency_admin:
        raise HTTPException(status_code=403, detail="Only agency admins can manage project members")
        
    await get_project(project_id, db, tenant_ctx)
    
    # Check if membership exists
    member_result = await db.execute(
        select(models.ProjectMember)
        .where(models.ProjectMember.project_id == project_id, models.ProjectMember.user_id == user_id)
    )
    project_member = member_result.scalar_one_or_none()
    if not project_member:
        raise HTTPException(status_code=404, detail="Member not found in project")
        
    # Delete project member record
    await db.delete(project_member)
    
    # EDGE CASE: Clean up task assignments
    # 1. Find incomplete tasks assigned to this user in this project
    task_query = select(models.Task).where(
        models.Task.project_id == project_id,
        models.Task.assignee_id == user_id,
        models.Task.status != "done"
    )
    task_result = await db.execute(task_query)
    incomplete_tasks = task_result.scalars().all()
    
    for task in incomplete_tasks:
        task.assignee_id = None
        # Add a system comment to document the change
        sys_comment = models.Comment(
            task_id=task.id,
            author_id=tenant_ctx["user"].id,
            content="System Note: Assignee was automatically unassigned because they were removed from the project.",
            is_internal=True
        )
        db.add(sys_comment)
        
    await db.commit()
    return {"message": "Member removed and tasks unassigned successfully"}
