from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime

from .. import schemas, models, database
from ..deps import get_current_tenant
from .projects import get_project

router = APIRouter(prefix="/api/projects/{project_id}/tasks", tags=["tasks"])

@router.get("/", response_model=List[schemas.TaskResponse])
async def list_tasks(
    project_id: int,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    query = select(models.Task).where(models.Task.project_id == project_id)
    if tenant_ctx["role"] == models.Role.client_user:
        query = query.where(models.Task.is_internal == False)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=schemas.TaskResponse)
async def create_task(
    project_id: int,
    task: schemas.TaskCreate,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    if tenant_ctx["role"] == models.Role.client_user:
        raise HTTPException(status_code=403, detail="Clients cannot create tasks")

    await get_project(project_id, db, tenant_ctx)
    
    db_task = models.Task(**task.model_dump(), project_id=project_id)
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    return db_task

@router.patch("/{task_id}", response_model=schemas.TaskResponse)
async def update_task(
    project_id: int,
    task_id: int,
    task_update: dict,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    if tenant_ctx["role"] == models.Role.client_user:
        raise HTTPException(status_code=403, detail="Clients cannot modify tasks")

    await get_project(project_id, db, tenant_ctx)
    
    result = await db.execute(
        select(models.Task).where(models.Task.id == task_id, models.Task.project_id == project_id)
    )
    db_task = result.scalar_one_or_none()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    for key, value in task_update.items():
        if hasattr(db_task, key):
            setattr(db_task, key, value)
            
    await db.commit()
    await db.refresh(db_task)
    return db_task

# Comments Endpoints
@router.get("/{task_id}/comments", response_model=List[schemas.CommentResponse])
async def list_comments(
    project_id: int,
    task_id: int,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    query = select(models.Comment).where(models.Comment.task_id == task_id)
    if tenant_ctx["role"] == models.Role.client_user:
        query = query.where(models.Comment.is_internal == False)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/{task_id}/comments", response_model=schemas.CommentResponse)
async def create_comment(
    project_id: int,
    task_id: int,
    comment: schemas.CommentCreate,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    # Check if task exists and is visible
    task_query = select(models.Task).where(models.Task.id == task_id, models.Task.project_id == project_id)
    if tenant_ctx["role"] == models.Role.client_user:
        task_query = task_query.where(models.Task.is_internal == False)
    task_result = await db.execute(task_query)
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Task not found or inaccessible")

    is_internal = comment.is_internal
    if tenant_ctx["role"] == models.Role.client_user:
        is_internal = False # Clients can never create internal comments

    db_comment = models.Comment(
        task_id=task_id,
        author_id=tenant_ctx["user"].id,
        content=comment.content,
        is_internal=is_internal
    )
    db.add(db_comment)
    await db.commit()
    await db.refresh(db_comment)
    return db_comment

# Time Tracking Endpoints
@router.get("/{task_id}/time", response_model=List[schemas.TimeEntryResponse])
async def list_time_entries(
    project_id: int,
    task_id: int,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    # Client users can see time entries, but we scope them based on visible tasks
    task_query = select(models.Task).where(models.Task.id == task_id, models.Task.project_id == project_id)
    if tenant_ctx["role"] == models.Role.client_user:
        task_query = task_query.where(models.Task.is_internal == False)
    task_result = await db.execute(task_query)
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Task not found or inaccessible")

    query = select(models.TimeEntry).where(models.TimeEntry.task_id == task_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/{task_id}/time", response_model=schemas.TimeEntryResponse)
async def create_time_entry(
    project_id: int,
    task_id: int,
    time_entry: schemas.TimeEntryCreate,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    # Only agency users can track time
    if tenant_ctx["role"] == models.Role.client_user:
        raise HTTPException(status_code=403, detail="Clients cannot log time entries")

    db_time = models.TimeEntry(
        task_id=task_id,
        user_id=tenant_ctx["user"].id,
        duration_minutes=time_entry.duration_minutes,
        note=time_entry.note,
        date=time_entry.date or datetime.utcnow()
    )
    db.add(db_time)
    await db.commit()
    await db.refresh(db_time)
    return db_time

# File Upload Endpoints
@router.get("/{task_id}/files", response_model=List[schemas.TaskFileResponse])
async def list_files(
    project_id: int,
    task_id: int,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    query = select(models.TaskFile).where(models.TaskFile.task_id == task_id)
    if tenant_ctx["role"] == models.Role.client_user:
        query = query.where(models.TaskFile.is_internal == False)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/{task_id}/files", response_model=schemas.TaskFileResponse)
async def upload_file(
    project_id: int,
    task_id: int,
    filename: str,
    is_internal: bool = False,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    if tenant_ctx["role"] == models.Role.client_user:
        is_internal = False # Clients upload client-visible files

    db_file = models.TaskFile(
        task_id=task_id,
        uploader_id=tenant_ctx["user"].id,
        filename=filename,
        file_path=f"uploads/{filename}",
        is_internal=is_internal,
        approval_status=models.ApprovalStatus.pending
    )
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)
    return db_file

@router.patch("/{task_id}/files/{file_id}", response_model=schemas.TaskFileResponse)
async def update_file_status(
    project_id: int,
    task_id: int,
    file_id: int,
    approval_status: models.ApprovalStatus,
    db: AsyncSession = Depends(database.get_db),
    tenant_ctx: dict = Depends(get_current_tenant)
):
    await get_project(project_id, db, tenant_ctx)
    
    # Any user (admin, member, client) can approve/request changes on a file they have visibility to
    query = select(models.TaskFile).where(models.TaskFile.id == file_id, models.TaskFile.task_id == task_id)
    if tenant_ctx["role"] == models.Role.client_user:
        query = query.where(models.TaskFile.is_internal == False)
        
    result = await db.execute(query)
    db_file = result.scalar_one_or_none()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    db_file.approval_status = approval_status
    await db.commit()
    await db.refresh(db_file)
    return db_file
