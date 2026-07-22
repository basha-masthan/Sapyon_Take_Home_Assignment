# 🚀 AgencyDesk

AgencyDesk is a multi-tenant client & project management platform purpose-built for agency-client work. It allows a single deployment to serve multiple agencies, where each agency operates in its own isolated tenant workspace.

This application is built with a focus on deep data modeling correctness, strict tenant isolation, and client-portal access control.

---

## 🛠️ Tech Stack

* **Backend:** Python 3, FastAPI, SQLAlchemy (Async), Alembic, Pydantic, PostgreSQL
* **Frontend:** React 18, Vite, TypeScript, Vanilla CSS (Premium Custom Design System)
* **Authentication:** Stateless JWT (JSON Web Tokens) with context headers

---

## 💻 Setup & Installation

### 1. Database Configuration
The application is configured to connect to your PostgreSQL database using the `DATABASE_URL` environment variable.

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and replace the `DATABASE_URL` with your actual PostgreSQL connection string. 

The connection string should use the async driver (`+asyncpg`) and configure SSL if needed. For example:
`postgresql+asyncpg://<username>:<password>@<host>/<database>?ssl=require`

---

### 2. Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a Python virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   * **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\activate
     ```
   * **macOS / Linux:**
     ```bash
     source venv/bin/activate
     ```

4. Install the required dependencies:
   ```bash
   pip install fastapi "uvicorn[standard]" sqlalchemy alembic pydantic pydantic-settings asyncpg psycopg2-binary pyjwt passlib bcrypt python-multipart pytest httpx email-validator "python-jose[cryptography]"
   ```

5. Run the database seeding script (already runs migrations and inserts test data):
   ```bash
   python seed.py
   ```

6. Start the FastAPI development server:
   ```bash
   python run.py
   ```
   * Backend will be running at: **`http://localhost:8000`**
   * Swagger Interactive API documentation: **`http://localhost:8000/docs`**

---

### 3. Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install npm packages:
   ```bash
   npm install
   ```

3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   * Frontend will be running at: **`http://localhost:5173`**

---

## 🔑 Test Credentials (Quick Login)
For easy evaluation, click the **"Quick Login"** buttons on the sign-in screen, or use the credentials below (Password is `password` for all):

| Account | Role | Tenant Context | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **`admin@agencya.com`** | `agency_admin` | Agency A | Full admin access (Create tasks, log hours, manage members, attach files) |
| **`admin@agencyb.com`** | `agency_admin` | Agency B | Full admin access for Tenant B (Completely isolated from Tenant A) |
| **`member@agencya.com`** | `agency_member` | Agency A | Project-scoped access (Can modify status, log hours, attach files, see comments) |
| **`client@example.com`** | `client_user` | Agency A & B | Client portal guest access (Can switch context between Agency A & B, view only client-visible items, leave comments, approve/reject attachments) |

---

## 🛡️ Edge Cases Handled Explicitly

1. **Cross-Tenant Access Protection:** 
   Enforced at the SQL query layer. Every project/task fetch is filtered by the active `X-Agency-ID` verified against the user's active membership inside the JWT context. Guesses of random IDs from other tenants result in strict `403 Forbidden` or `404 Not Found` responses.
   
2. **Internal Content Leaking to Clients:** 
   Tasks, comments, and attachments support an `is_internal` boolean flag. If the active role resolved from the headers is `client_user`, the backend automatically injects `.where(Model.is_internal == False)` filters to all database queries.

3. **One Person, Two Agencies:** 
   The database structures users globally in `ad_users`. They are mapped to roles inside specific agencies/clients via `ad_agency_memberships` and `ad_client_memberships` tables. The frontend UI provides a clean dropdown to switch active context headers (`X-Agency-ID`) dynamically.

4. **Invite Races & Duplicate Accounts:** 
   Protected by database-level unique composite keys `UNIQUE(user_id, agency_id)` ensuring duplicate invitation acceptance or click spamming does not generate duplicate memberships.

5. **Removing a Team Member Mid-Task:** 
   Implemented on project member deletion. If a member is deleted, the backend automatically scans for all incomplete tasks assigned to them within the project, sets their `assignee_id` to `null` to put them back in the unassigned queue, and writes an automated system comment detailing the unassignment.