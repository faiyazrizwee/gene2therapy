import pytest
from fastapi.testclient import TestClient
import os

from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_status():
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_degs_workflow():
    # 1. Get mock file path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_dir, "mock_counts.csv")
    
    # 2. Upload file
    with open(file_path, "rb") as f:
        response = client.post(
            "/api/v1/analyses/degs/upload",
            files={"file": ("mock_counts.csv", f, "text/csv")}
        )
    
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["data"]["filename"] == "mock_counts.csv"
    assert res_data["data"]["genes"] == 100
    assert res_data["data"]["samples"] == 6
    assert "Control_1" in res_data["data"]["sample_names"]
    
    # 3. Start analysis
    analyze_payload = {
        "project_id": 1,
        "filename": "mock_counts.csv",
        "sample_group1": ["Control_1", "Control_2", "Control_3"],
        "sample_group2": ["Treatment_1", "Treatment_2", "Treatment_3"],
        "group1_name": "Control",
        "group2_name": "Treatment",
        "analysis_method": "t-test",
        "logFC_threshold": 1.0,
        "p_value_threshold": 0.05
    }
    
    response = client.post(
        "/api/v1/analyses/degs/analyze",
        json=analyze_payload
    )
    
    assert response.status_code == 200
    analysis_res = response.json()
    analysis_id = analysis_res["id"]
    assert analysis_res["status"] in ["pending", "completed", "running"]
    assert analysis_res["project_id"] == 1
    
    # 4. Check results (FastAPI TestClient runs BackgroundTasks synchronously at the end of the request)
    response = client.get(f"/api/v1/analyses/degs/results/{analysis_id}")
    assert response.status_code == 200
    results_res = response.json()
    
    assert results_res["success"] is True
    assert results_res["data"]["status"] == "completed"
    assert results_res["data"]["summary"]["total_genes"] == 100
    assert results_res["data"]["summary"]["analysis_method"] == "t-test"
    assert len(results_res["data"]["results"]) > 0
    assert results_res["data"]["group_names"] == {
        "group1": "Control",
        "group2": "Treatment"
    }
    assert "heatmap_data" in results_res["data"]
    heatmap_data = results_res["data"]["heatmap_data"]
    assert len(heatmap_data) <= 20

    upregulated_heatmap = [row for row in heatmap_data if row["logFC"] > 0]
    downregulated_heatmap = [row for row in heatmap_data if row["logFC"] < 0]

    assert len(upregulated_heatmap) <= 10
    assert len(downregulated_heatmap) <= 10
    assert upregulated_heatmap == sorted(upregulated_heatmap, key=lambda row: row["logFC"], reverse=True)
    assert downregulated_heatmap == sorted(downregulated_heatmap, key=lambda row: row["logFC"])
    assert heatmap_data == upregulated_heatmap + downregulated_heatmap
    
    # Verify we got significant results
    assert results_res["data"]["summary"]["significant_degs"] > 0
