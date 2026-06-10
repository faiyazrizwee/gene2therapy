"""
Application configuration using Pydantic settings
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import os


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # App
    APP_NAME: str = "Gene2Therapy"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # API
    API_V1_STR: str = "/api/v1"
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "https://gene2therapy.vercel.app",
        "https://gene2therapy-ntcsssapc-md-faiyaz-rizwees-projects.vercel.app"
    ]
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://gene_user:gene_password@localhost:5432/gene2therapy"
    )
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    
    # Security
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "dev-secret-key-change-in-production"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # File uploads
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024
    UPLOAD_DIR: str = "/tmp/gene2therapy/uploads"
    
    # External APIs
    NCBI_EMAIL: str = os.getenv("NCBI_EMAIL", "")
    NCBI_API_KEY: str = os.getenv("NCBI_API_KEY", "")
    NCBI_TIMEOUT: int = 30
    NCBI_MAX_RETRIES: int = 2
    
    KEGG_TIMEOUT: int = 30
    KEGG_MAX_RETRIES: int = 2
    KEGG_REQUESTS_PER_SECOND: int = 10
    
    OPENTARGETS_TIMEOUT: int = 30
    OPENTARGETS_MAX_RETRIES: int = 2
    OPENTARGETS_REQUESTS_PER_SECOND: int = 10
    
    # Analysis limits
    MAX_GENES: int = 200
    MAX_NETWORK_NODES: int = 1000
    MAX_DISPLAY_ROWS: int = 500

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "on", "debug", "development", "dev"}
        return False
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
