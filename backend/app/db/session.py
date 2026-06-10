"""
Database session management
"""

from sqlalchemy.orm import Session
from app.db.base import SessionLocal


def get_db():
    """Database session dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
