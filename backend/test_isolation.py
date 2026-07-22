import asyncio
import httpx

API_BASE = "http://localhost:8000"

async def test_isolation():
    async with httpx.AsyncClient(base_url=API_BASE) as client:
        print("--- Testing Tenant Isolation ---")
        
        # 1. Login as Admin A
        resp_a = await client.post("/api/auth/login", data={"username": "admin@agencya.com", "password": "password"})
        token_a = resp_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}", "X-Agency-ID": "1"} # Assuming agency 1 is A
        
        # 2. Login as Admin B
        resp_b = await client.post("/api/auth/login", data={"username": "admin@agencyb.com", "password": "password"})
        token_b = resp_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}", "X-Agency-ID": "2"} # Assuming agency 2 is B
        
        # Admin A gets their projects
        proj_a = await client.get("/api/projects/", headers=headers_a)
        projects_a = proj_a.json()
        print(f"Admin A Projects: {[p['name'] for p in projects_a]}")
        project_a_id = projects_a[0]["id"]
        
        # Admin B gets their projects
        proj_b = await client.get("/api/projects/", headers=headers_b)
        projects_b = proj_b.json()
        print(f"Admin B Projects: {[p['name'] for p in projects_b]}")
        project_b_id = projects_b[0]["id"]
        
        # Admin B tries to access Admin A's project
        proj_a_by_b = await client.get(f"/api/projects/{project_a_id}", headers=headers_b)
        print(f"Admin B accessing Project A (Expected 404/403): {proj_a_by_b.status_code}")
        assert proj_a_by_b.status_code in [403, 404], "Tenant Isolation Failed!"
        
        # Admin A tries to access Admin B's project tasks
        tasks_b_by_a = await client.get(f"/api/projects/{project_b_id}/tasks", headers=headers_a)
        print(f"Admin A accessing Project B Tasks (Expected 404/403): {tasks_b_by_a.status_code}")
        assert tasks_b_by_a.status_code in [403, 404], "Tenant Isolation Failed!"

        print("\n--- Testing Client Visibility ---")
        
        # Admin A gets tasks for project A
        tasks_a = await client.get(f"/api/projects/{project_a_id}/tasks", headers=headers_a)
        all_tasks = tasks_a.json()
        print(f"Admin A sees {len(all_tasks)} tasks on Project A: {[t['title'] for t in all_tasks]}")
        
        # Login as Client (Client Corp A)
        resp_c = await client.post("/api/auth/login", data={"username": "client@example.com", "password": "password"})
        token_c = resp_c.json()["access_token"]
        
        # Get clients for user
        clients_resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_c}"})
        client_data = clients_resp.json()
        client_a_id = next(c["client"]["id"] for c in client_data["client_memberships"] if c["client"]["agency_id"] == 1)
        
        headers_c = {"Authorization": f"Bearer {token_c}", "X-Agency-ID": "1", "X-Client-ID": str(client_a_id)}
        
        # Client gets tasks for project A
        tasks_c = await client.get(f"/api/projects/{project_a_id}/tasks", headers=headers_c)
        visible_tasks = tasks_c.json()
        print(f"Client sees {len(visible_tasks)} tasks on Project A: {[t['title'] for t in visible_tasks]}")
        
        # Check that none of the client's tasks are internal
        internal_tasks = [t for t in visible_tasks if t['is_internal']]
        print(f"Internal tasks visible to client (Expected 0): {len(internal_tasks)}")
        assert len(internal_tasks) == 0, "Client Visibility Failed!"
        
        print("\nAll tests passed successfully! Isolation rules hold.")

if __name__ == "__main__":
    asyncio.run(test_isolation())
