import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from .models import Role, ApprovalStatus

# Common
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

# Users
class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True

# Agencies
class AgencyBase(BaseModel):
    name: str

class AgencyCreate(AgencyBase):
    pass

class AgencyResponse(AgencyBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True

# Clients
class ClientBase(BaseModel):
    name: str

class ClientCreate(ClientBase):
    pass

class ClientResponse(ClientBase):
    id: int
    agency_id: int
    class Config:
        from_attributes = True

# Projects
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    client_id: int

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: int
    agency_id: int
    class Config:
        from_attributes = True

# Tasks
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "medium"
    due_date: Optional[datetime.datetime] = None
    assignee_id: Optional[int] = None
    is_internal: bool = False

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id: int
    project_id: int
    class Config:
        from_attributes = True

# Comments
class CommentBase(BaseModel):
    content: str
    is_internal: bool = False

class CommentCreate(CommentBase):
    pass

class CommentResponse(CommentBase):
    id: int
    task_id: int
    author_id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True

# TaskFiles
class TaskFileBase(BaseModel):
    filename: str
    is_internal: bool = False

class TaskFileResponse(TaskFileBase):
    id: int
    task_id: int
    uploader_id: int
    file_path: str
    approval_status: ApprovalStatus
    created_at: datetime.datetime
    class Config:
        from_attributes = True

# Time Entries
class TimeEntryBase(BaseModel):
    duration_minutes: int
    note: Optional[str] = None
    date: Optional[datetime.datetime] = None

class TimeEntryCreate(TimeEntryBase):
    pass

class TimeEntryResponse(TimeEntryBase):
    id: int
    task_id: int
    user_id: int
    date: datetime.datetime
    class Config:
        from_attributes = True
