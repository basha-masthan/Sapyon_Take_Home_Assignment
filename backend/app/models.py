import datetime
import enum
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, Enum, Float, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Role(str, enum.Enum):
    agency_admin = "agency_admin"
    agency_member = "agency_member"
    client_user = "client_user"

class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    needs_changes = "needs_changes"

class User(Base):
    __tablename__ = "ad_users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    agency_memberships = relationship("AgencyMembership", back_populates="user")
    client_memberships = relationship("ClientMembership", back_populates="user")

class Agency(Base):
    __tablename__ = "ad_agencies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    memberships = relationship("AgencyMembership", back_populates="agency")
    clients = relationship("Client", back_populates="agency")
    projects = relationship("Project", back_populates="agency")

class AgencyMembership(Base):
    __tablename__ = "ad_agency_memberships"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("ad_users.id"), nullable=False)
    agency_id = Column(Integer, ForeignKey("ad_agencies.id"), nullable=False)
    role = Column(Enum(Role), nullable=False)
    
    __table_args__ = (UniqueConstraint("user_id", "agency_id", name="uq_agency_member"),)
    
    user = relationship("User", back_populates="agency_memberships")
    agency = relationship("Agency", back_populates="memberships")

class Client(Base):
    __tablename__ = "ad_clients"
    id = Column(Integer, primary_key=True, index=True)
    agency_id = Column(Integer, ForeignKey("ad_agencies.id"), nullable=False)
    name = Column(String, nullable=False)

    agency = relationship("Agency", back_populates="clients")
    memberships = relationship("ClientMembership", back_populates="client")
    projects = relationship("Project", back_populates="client")

class ClientMembership(Base):
    __tablename__ = "ad_client_memberships"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("ad_users.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("ad_clients.id"), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "client_id", name="uq_client_member"),)

    user = relationship("User", back_populates="client_memberships")
    client = relationship("Client", back_populates="memberships")

class Project(Base):
    __tablename__ = "ad_projects"
    id = Column(Integer, primary_key=True, index=True)
    agency_id = Column(Integer, ForeignKey("ad_agencies.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("ad_clients.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    agency = relationship("Agency", back_populates="projects")
    client = relationship("Client", back_populates="projects")
    project_members = relationship("ProjectMember", back_populates="project")
    tasks = relationship("Task", back_populates="project")

class ProjectMember(Base):
    __tablename__ = "ad_project_members"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("ad_projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("ad_users.id"), nullable=False)

    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_member"),)

    project = relationship("Project", back_populates="project_members")
    user = relationship("User")

class Task(Base):
    __tablename__ = "ad_tasks"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("ad_projects.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="todo") # todo, in_progress, done
    priority = Column(String, default="medium") # low, medium, high
    assignee_id = Column(Integer, ForeignKey("ad_users.id"), nullable=True)
    due_date = Column(DateTime, nullable=True)
    is_internal = Column(Boolean, default=False, nullable=False)

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User")
    comments = relationship("Comment", back_populates="task")
    time_entries = relationship("TimeEntry", back_populates="task")
    files = relationship("TaskFile", back_populates="task")

class Comment(Base):
    __tablename__ = "ad_comments"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("ad_tasks.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("ad_users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    task = relationship("Task", back_populates="comments")
    author = relationship("User")

class TaskFile(Base):
    __tablename__ = "ad_task_files"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("ad_tasks.id"), nullable=False)
    uploader_id = Column(Integer, ForeignKey("ad_users.id"), nullable=False)
    file_path = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    is_internal = Column(Boolean, default=False, nullable=False)
    approval_status = Column(Enum(ApprovalStatus), default=ApprovalStatus.pending)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    task = relationship("Task", back_populates="files")
    uploader = relationship("User")

class TimeEntry(Base):
    __tablename__ = "ad_time_entries"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("ad_tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("ad_users.id"), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    note = Column(Text, nullable=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)

    task = relationship("Task", back_populates="time_entries")
    user = relationship("User")
