from contextlib import asynccontextmanager
from datetime import datetime
import uuid
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.v1.api import api_router
from app.api.v1.endpoints.health import router as health_router
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.websocket import manager
from app.services.seed_data import seed_database_idempotent


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables
    Base.metadata.create_all(bind=engine)
    # Idempotently seed default data on launch
    db = SessionLocal()
    try:
        seed_database_idempotent(db)
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


# Resolve frontend static distribution directory
frontend_dist = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../frontend/dist")
)


@app.get("/", tags=["Root"])
def root_info(request: Request):
    accept = request.headers.get("accept", "")
    index_file = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_file) and "text/html" in accept:
        return FileResponse(index_file)
    return {
        "project": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "api_v1_prefix": settings.API_V1_STR,
        "health_check": "/api/health",
        "websocket_events": "/ws/network-events",
    }


@app.websocket("/ws/network-events")
@app.websocket("/api/v1/ws/network-events")
async def websocket_network_events(websocket: WebSocket):
    """Real-time WebSocket endpoint for streaming simulation events, link state changes, and alerts."""
    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "event_id": f"EVT-CONN-{uuid.uuid4().hex[:8].upper()}",
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "CONNECTED",
            "event": "CONNECTED",
            "severity": "INFO",
            "resource_id": "WS-SERVER",
            "affected_resource": "WS-SERVER",
            "message": "Connected to emergency network telemetry feed",
        })
        while True:
            data = await websocket.receive_text()
            if data == "ping" or "ping" in data.lower():
                await websocket.send_json({
                    "event_id": f"EVT-PONG-{uuid.uuid4().hex[:8].upper()}",
                    "timestamp": datetime.utcnow().isoformat(),
                    "event_type": "PONG",
                    "event": "PONG",
                    "severity": "INFO",
                    "resource_id": "WS-SERVER",
                    "affected_resource": "WS-SERVER",
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# Mount Static Frontend SPA (if built)
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if (
            full_path.startswith("api")
            or full_path.startswith("ws")
            or full_path in ["docs", "openapi.json", "redoc", "health"]
        ):
            raise HTTPException(status_code=404, detail="Not Found")

        potential_file = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(potential_file):
            return FileResponse(potential_file)

        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Not Found")

