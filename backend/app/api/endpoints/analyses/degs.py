"""
Phase 1: Differential Expression Analysis (DEGs) Endpoints
"""

from IPython.core import async_helpers
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd
import io
import csv
import logging
from datetime import datetime
import os
import numpy as np

from app.core.config import settings
from app.db.session import get_db
from app.db.base import Analysis, AnalysisType, AnalysisStatus, DEGResult
from app.schemas.common import AnalysisResponse, SuccessResponse, DEGsAnalysisSummary, DEGsAnalysisRequest
from app.services.degs_service import DEGsAnalysisService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/degs", tags=["DEGs Analysis"])


def get_significant_results(analysis: Analysis, db: Session):
    summary = analysis.result_summary or {}

    logfc_threshold = summary.get("logFC_threshold", 1)
    pvalue_threshold = summary.get("p_value_threshold", 0.05)

    return (
        db.query(DEGResult)
        .filter(
            DEGResult.analysis_id == analysis.id,
            DEGResult.p_value < pvalue_threshold,
            func.abs(DEGResult.logFC) > logfc_threshold
        )
        .order_by(DEGResult.adj_p_value.asc())
        .all()
    )


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload expression count matrix (CSV/TSV)
    
    Returns: {filename, genes, samples, sample_names}
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    try:
        content = await file.read()
        
        # Save file to upload directory
        file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(content)
            
        # Detect delimiter
        if file.filename.endswith('.tsv'):
            df = pd.read_csv(file_path, sep='\t', index_col=0)
        else:
            df = pd.read_csv(file_path, index_col=0)
        
        logger.info(f"Uploaded file saved to {file_path}, shape: {df.shape}")
        
        return SuccessResponse(
            message="File uploaded successfully",
            data={
                "filename": file.filename,
                "genes": len(df),
                "samples": len(df.columns),
                "sample_names": df.columns.tolist(),
            }
        ).model_dump()
    
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")


async def run_degs_analysis_task(
    analysis_id: int,
    filename: str,
    sample_group1: list,
    sample_group2: list,
    group1_name: str,
    group2_name: str,
    analysis_method: str,
    logFC_threshold: float,
    p_value_threshold: float
):
    """Background task for DEGs analysis"""
    from app.db.base import SessionLocal
    db = SessionLocal()
    try:
        # Load counts from file
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        if filename.endswith('.tsv'):
            count_matrix = pd.read_csv(file_path, sep='\t', index_col=0)
        else:
            count_matrix = pd.read_csv(file_path, index_col=0)
            
        # Mark as running
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if analysis:
            analysis.status = AnalysisStatus.RUNNING
            db.commit()
        
        # Run analysis
        all_results, upregulated, downregulated = DEGsAnalysisService.run_analysis(
            count_matrix=count_matrix,
            sample_group1=sample_group1,
            sample_group2=sample_group2,
            data_is_normalized=False,
            analysis_method=analysis_method,
            logFC_threshold=logFC_threshold,
            p_value_threshold=p_value_threshold
        )
        
        # Generate PCA coordinates
        pca_results = DEGsAnalysisService.generate_pca_data(
            count_matrix=count_matrix,
            sample_group1=sample_group1,
            sample_group2=sample_group2,
            group1_name=group1_name,
            group2_name=group2_name
        )

        # Store results
        records = [
            {
                "analysis_id": analysis_id,
                "gene": row["Gene"],
                "logFC": float(row["logFC"]),
                "p_value": float(row["p_value"]),
                "adj_p_value": float(row.get("adj_p_value", 1.0)),
                "mean_group1": float(row["mean_group1"]),
                "mean_group2": float(row["mean_group2"])
            }
            for _, row in all_results.iterrows()
        ]
        
        db.bulk_insert_mappings(DEGResult, records)
        
        # Update analysis
        analysis.status = AnalysisStatus.COMPLETED
        analysis.result_summary = {
            "total_genes": len(all_results),
            "significant_degs": len(upregulated) + len(downregulated),
            "upregulated": len(upregulated),
            "downregulated": len(downregulated),
            "analysis_method": analysis_method,
            "logFC_threshold": logFC_threshold,
            "p_value_threshold": p_value_threshold,
            "pca": pca_results
        }
        analysis.completed_at = datetime.utcnow()
        
        db.commit()
        logger.info(f"Analysis {analysis_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Analysis {analysis_id} failed: {e}")
        try:
            analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
            if analysis:
                analysis.status = AnalysisStatus.FAILED
                analysis.error_message = str(e)
                db.commit()
        except Exception as db_err:
            logger.error(f"Failed to record analysis failure to db: {db_err}")
    finally:
        db.close()


@router.post("/analyze", response_model=AnalysisResponse)
async def start_analysis(
    request: DEGsAnalysisRequest,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """
    Start differential expression analysis
    
    Returns: {analysis_id, status}
    """
    try:
        # Create analysis record
        analysis = Analysis(
            project_id=request.project_id,
            analysis_type=AnalysisType.DEGS,
            status=AnalysisStatus.PENDING,
            input_data={
                "sample_group1": request.sample_group1,
                "sample_group2": request.sample_group2,
                "group1_name": request.group1_name,
                "group2_name": request.group2_name
            },
            parameters={
                "analysis_method": request.analysis_method,
                "logFC_threshold": request.logFC_threshold,
                "p_value_threshold": request.p_value_threshold
            }
        )
        
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        
        # Queue background task
        background_tasks.add_task(
            run_degs_analysis_task,
            analysis.id,
            request.filename,
            request.sample_group1,
            request.sample_group2,
            request.group1_name,
            request.group2_name,
            request.analysis_method,
            request.logFC_threshold,
            request.p_value_threshold
        )
        
        logger.info(f"Analysis {analysis.id} queued for processing")
        
        return analysis
        
    except Exception as e:
        logger.error(f"Failed to start analysis: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/results/{analysis_id}")
async def get_results(
    analysis_id: int,
    limit: int = 500,
    db: Session = Depends(get_db)
):
    """
    Get DEGs analysis results with pagination
    
    Returns: Results with summary and pagination info
    """
    try:
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        
        if not analysis:
            raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
        
        significant_results = get_significant_results(analysis, db)
        top_results = significant_results[:limit]

        top_upregulated_genes = sorted(
            [r for r in significant_results if r.logFC > 0],
            key=lambda x: x.logFC,
            reverse=True
        )[:10]
        top_downregulated_genes = sorted(
            [r for r in significant_results if r.logFC < 0],
            key=lambda x: x.logFC
        )[:10]
        heatmap_results = top_upregulated_genes + top_downregulated_genes

        all_results_for_ma = (
            db.query(DEGResult)
            .filter(DEGResult.analysis_id == analysis.id)
            .limit(10000)
            .all()
        )

        ma_plot_data = [
            {
                "gene": r.gene,
                "A": float(
                    np.log2(
                        ((r.mean_group1 + r.mean_group2) / 2) + 1
                    )
                ),
                "logFC": r.logFC,
                "p_value": r.p_value,
                "adj_p_value": r.adj_p_value,
                "significant": (
                    r.adj_p_value is not None
                    and r.adj_p_value < 0.05
                )
            }
            for r in all_results_for_ma
        ]

        input_data = analysis.input_data or {}
        group1_name = input_data.get("group1_name", "Control")
        group2_name = input_data.get("group2_name", "Treatment")
        summary = analysis.result_summary or {}
        pca_data = summary.get("pca", {})
        
        return SuccessResponse(
            message="Results retrieved successfully",
            data={
                "analysis_id": analysis.id,
                "status": analysis.status.value,
                "summary": analysis.result_summary,
                "error": analysis.error_message,
                "results_count": len(top_results),
                "total_significant_genes": len(significant_results),
                "group_names": {
                    "group1": group1_name,
                    "group2": group2_name
                },
                "results": [
                    {
                        "gene": r.gene,
                        "logFC": r.logFC,
                        "p_value": r.p_value,
                        "adj_p_value": r.adj_p_value,
                        "mean_group1": r.mean_group1,
                        "mean_group2": r.mean_group2
                    } for r in top_results
                ],
                "heatmap_data": [
                    {
                        "gene": r.gene,
                        "group1": r.mean_group1,
                        "group2": r.mean_group2,
                        "logFC": r.logFC
                    } for r in heatmap_results
                ],   
                "pca_data": pca_data,
                "ma_plot_data": ma_plot_data
            }
        ).model_dump()
        
    except Exception as e:
        logger.error(f"Failed to get results: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/results/{analysis_id}/export")
async def export_significant_results(
    analysis_id: int,
    format: str = "csv",
    db: Session = Depends(get_db)
):
    """
    Export all significant DEGs, not just the top rows returned to the UI.
    """
    try:
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()

        if not analysis:
            raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")

        if format not in {"csv", "xls"}:
            raise HTTPException(status_code=400, detail="format must be csv or xls")

        significant_results = get_significant_results(analysis, db)
        delimiter = "," if format == "csv" else "\t"
        output = io.StringIO()
        writer = csv.writer(output, delimiter=delimiter)
        writer.writerow([
            "Gene",
            "log2 Fold Change",
            "p-value",
            "Adjusted p-value",
            "Direction",
            "Mean group 1",
            "Mean group 2"
        ])

        for result in significant_results:
            writer.writerow([
                result.gene,
                result.logFC,
                result.p_value,
                result.adj_p_value,
                "Upregulated" if result.logFC > 0 else "Downregulated",
                result.mean_group1,
                result.mean_group2
            ])

        media_type = "text/csv" if format == "csv" else "application/vnd.ms-excel"
        filename = f"all_significant_DEGs.{format}"

        return Response(
            content=output.getvalue(),
            media_type=f"{media_type}; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export DEG results: {e}")
        raise HTTPException(status_code=400, detail=str(e))
