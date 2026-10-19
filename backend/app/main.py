from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.api.v1.endpoints.health import router as health_router
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.services.simulation import seed_default_nodes_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables
    Base.metadata.create_all(bind=engine)
    # Seed default nodes on initial launch
    db = SessionLocal()
    try:
        seed_default_nodes_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Emergency Communication Network with Priority Routing Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount root health endpoints for convenient monitoring
app.include_router(health_router, prefix="/api")
app.include_router(health_router)

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root_info():
    return {
        "project": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "api_v1_prefix": settings.API_V1_STR,
        "health_check": "/api/health",
    }
