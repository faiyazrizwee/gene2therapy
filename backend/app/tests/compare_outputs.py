import pandas as pd
import numpy as np
import sys
import os

# Add paths to sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.append("/home/faiyaz/python/minor_proj_STREAMLIT")

from app.services.degs_service import DEGsAnalysisService
# Mock streamlit dependencies before importing streamlit main to avoid set_page_config error
import streamlit as st
class MockPageConfig:
    def __getattr__(self, name):
        return lambda *args, **kwargs: None
st.set_page_config = lambda *args, **kwargs: None
st.warning = lambda *args, **kwargs: None
st.success = lambda *args, **kwargs: None
st.error = lambda *args, **kwargs: None
st.info = lambda *args, **kwargs: None

import main as streamlit_main

def test_compare():
    csv_path = os.path.join(os.path.dirname(__file__), "mock_counts.csv")
    
    # 1. Run using Streamlit functions
    df_st = pd.read_csv(csv_path, index_col=0)
    # Mock clean since we don't have st context
    df_st_clean = streamlit_main.validate_and_clean_count_matrix(df_st)
    df_st_cpm = streamlit_main.normalize_to_cpm(df_st_clean)
    results_st = streamlit_main.calculate_differential_expression_fast(
        df_st_cpm, 
        ["Control_1", "Control_2", "Control_3"], 
        ["Treatment_1", "Treatment_2", "Treatment_3"]
    )
    
    # 2. Run using Backend service
    results_backend, _, _ = DEGsAnalysisService.run_analysis(
        df_st,
        ["Control_1", "Control_2", "Control_3"], 
        ["Treatment_1", "Treatment_2", "Treatment_3"],
        data_is_normalized=False,
        analysis_method="t-test"
    )
    
    # Compare
    # results_st should have same Gene, logFC, p_value, mean_group1, mean_group2
    results_st = results_st.sort_values('Gene').reset_index(drop=True)
    results_backend = results_backend.sort_values('Gene').reset_index(drop=True)
    
    np.testing.assert_array_almost_equal(results_st['logFC'].values, results_backend['logFC'].values)
    np.testing.assert_array_almost_equal(results_st['p_value'].values, results_backend['p_value'].values)
    print("✅ Mathematical verification SUCCESSFUL! Results are identical between original Streamlit code and backend FastAPI service.")

if __name__ == "__main__":
    test_compare()
