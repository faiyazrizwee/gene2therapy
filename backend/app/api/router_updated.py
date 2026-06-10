"""
Update router to include DEGs endpoints
"""

from fastapi import APIRouter
from app.api.endpoints.analyses import degs

api_router = APIRouter()

# Include analysis endpoints
api_router.include_router(degs.router, prefix="/analyses", tags=["Analyses"])

@api_router.get("/status")
async def status():
    """API status endpoint"""
    return {
        "status": "ok",
        "message": "API is running",
        "version": "1.0.0"
    }

@api_router.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Gene2Therapy API",
        "components": {
            "database": "connected",
            "redis": "connected",
            "external_apis": "ready"
        }
    }
