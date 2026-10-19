from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.database import get_db
from app.schemas.health import HealthCheckResponse

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse, tags=["Health"])
def get_health_status(db: Session = Depends(get_db)):
    """Health check endpoint validating server and SQLite database connection."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return HealthCheckResponse(
        status="ok" if db_status == "connected" else "degraded",
        app_name=settings.PROJECT_NAME,
        version="1.0.0",
        timestamp=datetime.utcnow(),
        database=db_status,
        details={
            "environment": "local",
            "api_version": settings.API_V1_STR,
            "engine": "FastAPI + SQLite",
        },
    )
