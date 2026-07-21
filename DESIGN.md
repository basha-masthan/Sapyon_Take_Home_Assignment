# AgencyDesk Design & Architecture

## Multi-Tenancy & Tenant Isolation
AgencyDesk employs **Row-Level Tenant Isolation** combined with a robust Dependency Injection pattern in FastAPI. Every table that belongs to a specific tenant (e.g., Projects, Clients) has an `agency_id` column.
For every API request, a `get_current_tenant` dependency:
1. Extracts the `X-Agency-ID` header.
2. Validates that the globally authenticated `User` actually possesses an active `AgencyMembership` or `ClientMembership` linked to that `agency_id`.
3. Injects this validated `tenant_ctx` into the route handler. 
All subsequent SQLAlchemy queries explicitly filter by `models.Project.agency_id == tenant_ctx['agency_id']`, making it mathematically impossible for Tenant A to query Tenant B's data, even if they guess a valid ID.

## Internal Content Blocking for Clients
For resources like `tasks`, `comments`, and `task_files`, we have a boolean `is_internal` flag. 
The injected `tenant_ctx` accurately identifies the user's role (e.g., `client_user`). If the role is `client_user`, the data access layer dynamically appends `.where(Model.is_internal == False)` to the base query. This happens at the SQL level, ensuring that internal content never even reaches the API serialization layer, eliminating the risk of accidental leakage.

## Global Identity Model (One Person, Two Agencies)
A single user might be a freelancer who is an `agency_admin` for one agency, and a `client_user` for another.
To support this cleanly:
- **Global Authentication**: The `ad_users` table handles identity globally (email and password_hash).
- **Contextual Authorization**: The `ad_agency_memberships` and `ad_client_memberships` tables act as junction tables that map a `User` to a specific `Agency` or `Client` with a specific `Role`. 
When a user logs in, they receive a single JWT. They can then switch contexts in the UI (which changes the `X-Agency-ID` header), and the backend dynamically resolves their role for that specific context.

## Handled Edge Case: Invite Races & Duplicate Assignments
We handle invite races gracefully using database-level composite unique constraints on our membership tables (e.g., `UNIQUE(user_id, agency_id)`). This guarantees that resending an invite or clicking "Accept" twice in rapid succession cannot create duplicate accounts or duplicate memberships. The backend cleanly catches the `IntegrityError` and returns a 200 OK or 409 Conflict as appropriate, ensuring idempotency.

Additionally, for removing a team member mid-task, the system explicitly queries tasks assigned to that user in the project and sets `assignee_id = null` while generating an automated audit comment, preventing orphaned tasks assigned to unauthorized users.
