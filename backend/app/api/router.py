"""
Main API router combining all endpoints
"""

from fastapi import APIRouter
from app.api.endpoints.analyses import degs, pathway

api_router = APIRouter()

# Include analysis endpoints
api_router.include_router(degs.router, prefix="/analyses", tags=["Analyses"])
api_router.include_router(pathway.router, prefix="/analyses", tags=["Analyses"])


@api_router.get("/status")
async def status():
    """API status endpoint"""
    return {
        "status": "ok",
        "message": "API is running",
        "version": "1.0.0"
    }
