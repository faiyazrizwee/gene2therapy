"""
Exception handlers and error middleware
"""

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

logger = logging.getLogger(__name__)


def setup_exception_handlers(app: FastAPI):
    """Setup exception handlers for the application"""
    
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request, exc):
        return {
            "success": False,
            "error": exc.detail,
            "status_code": exc.status_code
        }
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc):
        logger.error(f"Validation error: {exc}")
        return {
            "success": False,
            "error": "Validation error",
            "details": exc.errors()
        }
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request, exc):
        logger.error(f"Unexpected error: {exc}")
        return {
            "success": False,
            "error": "Internal server error",
            "message": str(exc) if hasattr(exc, '__str__') else "Unknown error"
        }
