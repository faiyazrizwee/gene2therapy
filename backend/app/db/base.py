"""
SQLAlchemy database configuration and models
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, JSON, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import enum

from app.core.config import settings

# Create engine
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        echo=settings.DEBUG,
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


class AnalysisType(str, enum.Enum):
    """Analysis type enumeration"""
    DEGS = "degs"
    PATHWAY = "pathway"
    DRUGS = "drugs"


class AnalysisStatus(str, enum.Enum):
    """Analysis status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    """User model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class Project(Base):
    """Project model (collection of analyses)"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    owner = relationship("User", back_populates="projects")
    analyses = relationship("Analysis", back_populates="project", cascade="all, delete-orphan")


class Analysis(Base):
    """Analysis job model"""
    __tablename__ = "analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    analysis_type = Column(SQLEnum(AnalysisType), index=True)
    status = Column(SQLEnum(AnalysisStatus), default=AnalysisStatus.PENDING, index=True)
    
    # Input data (serialized)
    input_data = Column(JSON)
    parameters = Column(JSON)
    
    # Results metadata
    result_summary = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    project = relationship("Project", back_populates="analyses")
    deg_results = relationship("DEGResult", back_populates="analysis", cascade="all, delete-orphan")
    pathway_results = relationship("PathwayResult", back_populates="analysis", cascade="all, delete-orphan")
    drug_results = relationship("DrugResult", back_populates="analysis", cascade="all, delete-orphan")


class DEGResult(Base):
    """DEG analysis results"""
    __tablename__ = "deg_results"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), index=True)
    
    gene = Column(String, index=True)
    logFC = Column(Float)
    p_value = Column(Float)
    adj_p_value = Column(Float, nullable=True)
    mean_group1 = Column(Float)
    mean_group2 = Column(Float)
    
    analysis = relationship("Analysis", back_populates="deg_results")


class PathwayResult(Base):
    """Pathway enrichment results"""
    __tablename__ = "pathway_results"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), index=True)
    
    pathway_id = Column(String, index=True)
    pathway_name = Column(String)
    gene_count = Column(Integer)
    genes = Column(JSON)
    
    analysis = relationship("Analysis", back_populates="pathway_results")


class DrugResult(Base):
    """Drug discovery results"""
    __tablename__ = "drug_results"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), index=True)
    
    gene = Column(String, index=True)
    drug_name = Column(String, index=True)
    drug_id = Column(String)
    phase = Column(String)
    status = Column(String)
    moa = Column(String)
    disease_name = Column(String)
    therapeutic_areas = Column(JSON)
    
    analysis = relationship("Analysis", back_populates="drug_results")


class APICache(Base):
    """API response cache"""
    __tablename__ = "api_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String, index=True)
    query_hash = Column(String, unique=True, index=True)
    response = Column(JSON)
    expires_at = Column(DateTime, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
