from fastapi import APIRouter
from app.api.v1.endpoints import health, nodes, simulation

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(nodes.router, prefix="/nodes")
api_router.include_router(simulation.router, prefix="/simulation")
