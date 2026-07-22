import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import async_session_maker
from app.models import (
    User, Agency, AgencyMembership, Role, Client, ClientMembership,
    Project, ProjectMember, Task, Comment
)
from app.auth import get_password_hash

async def seed():
    async with async_session_maker() as session:
        # Check if already seeded
        result = await session.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            print("Database already contains data, skipping seed.")
            return

        # Create users
        admin_pass = get_password_hash("password")
        
        user1 = User(email="admin@agencya.com", full_name="Admin A", password_hash=admin_pass)
        user2 = User(email="admin@agencyb.com", full_name="Admin B", password_hash=admin_pass)
        user3 = User(email="member@agencya.com", full_name="Member A", password_hash=admin_pass)
        user4 = User(email="client@example.com", full_name="Client Shared", password_hash=admin_pass)
        user5 = User(email="member2@agencya.com", full_name="Member A2", password_hash=admin_pass)
        user6 = User(email="member1@agencyb.com", full_name="Member B1", password_hash=admin_pass)
        user7 = User(email="client2@example.com", full_name="Client Corp B Shared", password_hash=admin_pass)
        
        session.add_all([user1, user2, user3, user4, user5, user6, user7])
        await session.flush()
        
        # Create agencies
        agency1 = Agency(name="Agency A")
        agency2 = Agency(name="Agency B")
        
        session.add_all([agency1, agency2])
        await session.flush()
        
        # Create agency memberships
        session.add_all([
            AgencyMembership(user_id=user1.id, agency_id=agency1.id, role=Role.agency_admin),
            AgencyMembership(user_id=user2.id, agency_id=agency2.id, role=Role.agency_admin),
            AgencyMembership(user_id=user3.id, agency_id=agency1.id, role=Role.agency_member),
            AgencyMembership(user_id=user5.id, agency_id=agency1.id, role=Role.agency_member),
            AgencyMembership(user_id=user6.id, agency_id=agency2.id, role=Role.agency_member),
        ])
        
        # Create clients
        client1 = Client(agency_id=agency1.id, name="Client Corp A")
        client2 = Client(agency_id=agency2.id, name="Client Corp B")
        
        session.add_all([client1, client2])
        await session.flush()
        
        # Create client memberships (user4 is a client of both agencies)
        session.add_all([
            ClientMembership(user_id=user4.id, client_id=client1.id),
            ClientMembership(user_id=user4.id, client_id=client2.id),
            ClientMembership(user_id=user7.id, client_id=client2.id)
        ])
        
        # Create projects
        project1 = Project(agency_id=agency1.id, client_id=client1.id, name="Project A1")
        project2 = Project(agency_id=agency2.id, client_id=client2.id, name="Project B1")
        
        session.add_all([project1, project2])
        await session.flush()
        
        session.add_all([
            ProjectMember(project_id=project1.id, user_id=user3.id),
            ProjectMember(project_id=project1.id, user_id=user5.id),
            ProjectMember(project_id=project2.id, user_id=user6.id)
        ])
        
        # Create tasks
        task1 = Task(project_id=project1.id, title="Client Task A1", is_internal=False)
        task2 = Task(project_id=project1.id, title="Internal Task A1", is_internal=True)
        task3 = Task(project_id=project2.id, title="Client Task B1", is_internal=False)
        
        session.add_all([task1, task2, task3])
        
        await session.commit()
        print("Database seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
