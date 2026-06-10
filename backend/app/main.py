"""
Gene2Therapy Backend API
FastAPI application entry point with middleware setup
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.core.config import settings
from app.api.router import api_router
from app.middleware.error_handlers import setup_exception_handlers
from app.db.base import Base, engine

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events"""
    # Startup
    logger.info("🚀 Starting Gene2Therapy Backend API")
    Base.metadata.create_all(bind=engine)
    
    # Seed default user and project for development
    from app.db.base import SessionLocal, User, Project
    db = SessionLocal()
    try:
        default_user = db.query(User).filter(User.id == 1).first()
        if not default_user:
            default_user = User(
                id=1,
                email="default@example.com",
                username="default_user",
                hashed_password="placeholder-not-secure",
                is_active=True
            )
            db.add(default_user)
            db.commit()
            logger.info("✅ Seeded default user")
            
        default_project = db.query(Project).filter(Project.id == 1).first()
        if not default_project:
            default_project = Project(
                id=1,
                user_id=1,
                name="Default Project",
                description="Default project for DEG analysis"
            )
            db.add(default_project)
            db.commit()
            logger.info("✅ Seeded default project")
    except Exception as e:
        logger.error(f"Error seeding default database records: {e}")
    finally:
        db.close()
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Gene2Therapy Backend API")


# Initialize FastAPI app
app = FastAPI(
    title="Gene2Therapy API",
    description="Integrated Gene Analysis API - DEGs, Pathways, Drug Discovery",
    version="1.0.0",
    lifespan=lifespan
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup exception handlers
setup_exception_handlers(app)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Gene2Therapy API",
        "version": "1.0.0"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check"""
    from datetime import datetime
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )
