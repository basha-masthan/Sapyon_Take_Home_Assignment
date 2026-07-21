from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AgencyDesk API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .routers import auth, projects, tasks

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(tasks.router)

@app.get("/api/health")
def read_root():
    return {"status": "ok"}
