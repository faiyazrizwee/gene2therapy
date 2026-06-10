"""
Shared Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class AnalysisTypeEnum(str, Enum):
    """Analysis types"""
    DEGS = "degs"
    PATHWAY = "pathway"
    DRUGS = "drugs"


class AnalysisStatusEnum(str, Enum):
    """Analysis statuses"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    username: str


class UserCreate(UserBase):
    """User creation schema"""
    password: str


class UserResponse(UserBase):
    """User response schema"""
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    """Base project schema"""
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    """Project creation schema"""
    pass


class ProjectResponse(ProjectBase):
    """Project response schema"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AnalysisCreate(BaseModel):
    """Analysis creation schema"""
    analysis_type: AnalysisTypeEnum
    parameters: Dict[str, Any]


class AnalysisResponse(BaseModel):
    """Analysis response schema"""
    id: int
    project_id: int
    analysis_type: AnalysisTypeEnum
    status: AnalysisStatusEnum
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    class Config:
        from_attributes = True


class DEGResultCreate(BaseModel):
    """DEG result creation"""
    gene: str
    logFC: float
    p_value: float
    adj_p_value: Optional[float] = None
    mean_group1: float
    mean_group2: float


class DEGResultResponse(DEGResultCreate):
    """DEG result response"""
    id: int
    analysis_id: int
    
    class Config:
        from_attributes = True


class DEGsAnalysisRequest(BaseModel):
    """DEGs analysis request"""
    project_id: int
    filename: str
    sample_group1: List[str]
    sample_group2: List[str]
    group1_name: str = "Group1"
    group2_name: str = "Group2"
    analysis_method: str = "DESeq2"
    logFC_threshold: float = Field(default=1.0, ge=0.0, le=5.0)
    p_value_threshold: float = Field(default=0.05, ge=0.001, le=1.0)


class DEGsAnalysisSummary(BaseModel):
    """DEGs analysis summary"""
    total_genes: int
    significant_degs: int
    upregulated: int
    downregulated: int
    analysis_method: str


class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """Generic error response"""
    success: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None


# --- Pathway & Drug Discovery Pipeline Schemas ---

class PathwayAnalysisRequest(BaseModel):
    """Pathway and drug discovery analysis request"""
    project_id: int
    genes: List[str]
    organism: str = Field(default="human", description="Organism: human, mouse, or rat")
    include_drugs: bool = Field(default=True, description="Query drug associations from Open Targets")


class PathwayResultResponse(BaseModel):
    """Single pathway enrichment result"""
    pathway_id: str
    pathway_name: str
    gene_count: int
    genes: List[str]

    class Config:
        from_attributes = True


class DrugResultResponse(BaseModel):
    """Single drug suggestion result"""
    gene: str
    drug_name: str
    drug_id: str
    phase: str
    status: str
    moa: str
    disease_name: str
    therapeutic_areas: List[str]

    class Config:
        from_attributes = True


class DiseaseResultResponse(BaseModel):
    """Single disease association result"""
    gene: str
    gene_symbol: str
    target: str
    disease_id: str
    disease_name: str
    association_score: float
    therapeutic_areas: str

