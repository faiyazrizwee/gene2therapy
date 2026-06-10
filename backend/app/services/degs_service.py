"""
Differential Expression Analysis Service
Extracted from Streamlit, production-hardened
"""

import pandas as pd
import numpy as np
from scipy.stats import ttest_ind
import logging
from typing import Tuple
import time

from pydeseq2.dds import DeseqDataSet
from pydeseq2.ds import DeseqStats
from sklearn.decomposition import PCA

logger = logging.getLogger(__name__)


class DEGsAnalysisService:
    """Service for differential expression analysis"""
    
    @staticmethod
    def validate_and_clean_count_matrix(count_matrix: pd.DataFrame) -> pd.DataFrame:
        """
        Validate and clean count matrix before analysis
        Extracted from: validate_and_clean_count_matrix()
        """
        cleaned_matrix = count_matrix.copy()
        
        # Check for duplicates
        duplicates = cleaned_matrix.index.duplicated().sum()
        if duplicates > 0:
            logger.warning(f"Found {duplicates} duplicate gene identifiers. Making unique...")
            unique_index = []
            gene_counts = {}
            
            for gene in cleaned_matrix.index:
                if gene not in gene_counts:
                    gene_counts[gene] = 1
                    unique_index.append(gene)
                else:
                    gene_counts[gene] += 1
                    unique_index.append(f"{gene}_dup{gene_counts[gene]}")
            
            cleaned_matrix.index = unique_index
        
        # Handle NaN values
        nan_count = cleaned_matrix.isna().sum().sum()
        if nan_count > 0:
            logger.warning(f"Found {nan_count} NaN values. Replacing with zeros...")
            cleaned_matrix = cleaned_matrix.fillna(0)
        
        # Handle negative values
        negative_count = (cleaned_matrix < 0).sum().sum()
        if negative_count > 0:
            logger.warning(f"Found {negative_count} negative values. Taking absolute...")
            cleaned_matrix = cleaned_matrix.abs()
        
        return cleaned_matrix
    
    @staticmethod
    def normalize_to_cpm(count_matrix: pd.DataFrame) -> pd.DataFrame:
        """
        Normalize counts to CPM (Counts Per Million)
        Extracted from: normalize_to_cpm()
        """
        library_sizes = count_matrix.sum(axis=0)
        cpm_matrix = count_matrix.div(library_sizes, axis=1) * 1e6
        return cpm_matrix
    
    @staticmethod
    def calculate_differential_expression_fast(
        count_matrix: pd.DataFrame,
        sample_group1: list,
        sample_group2: list
    ) -> pd.DataFrame:
        """
        Fast DEGs calculation using batch processing
        Extracted from: calculate_differential_expression_fast()
        """
        data_group1 = count_matrix[sample_group1].values
        data_group2 = count_matrix[sample_group2].values
        
        mean_group1 = np.mean(data_group1, axis=1)
        mean_group2 = np.mean(data_group2, axis=1)
        
        pseudocount = 0.1
        logFC = np.log2((mean_group2 + pseudocount) / (mean_group1 + pseudocount))
        
        p_values = []
        batch_size = 1000
        total_genes = len(count_matrix)
        
        for i in range(0, total_genes, batch_size):
            end_idx = min(i + batch_size, total_genes)
            batch_group1 = data_group1[i:end_idx]
            batch_group2 = data_group2[i:end_idx]
            
            for j in range(len(batch_group1)):
                g1_data = batch_group1[j]
                g2_data = batch_group2[j]
                
                if (np.isnan(g1_data).any() or np.isnan(g2_data).any() or 
                    np.isinf(g1_data).any() or np.isinf(g2_data).any()):
                    p_values.append(1.0)
                    continue
                
                if (np.std(g1_data) == 0 and np.std(g2_data) == 0 and 
                    np.mean(g1_data) == np.mean(g2_data)):
                    p_values.append(1.0)
                    continue
                
                try:
                    t_stat, p_val = ttest_ind(g1_data, g2_data, equal_var=False, nan_policy='omit')
                    p_values.append(p_val if not np.isnan(p_val) else 1.0)
                except Exception as e:
                    logger.error(f"T-test error for gene {i+j}: {e}")
                    p_values.append(1.0)
        
        results = pd.DataFrame({
            'Gene': count_matrix.index,
            'logFC': logFC,
            'p_value': p_values,
            'mean_group1': mean_group1,
            'mean_group2': mean_group2
        })
        
        return results
    
    @staticmethod
    def compute_deseq2_results(
        count_matrix: pd.DataFrame,
        sample_group1: list,
        sample_group2: list,
        group1_name: str = "Control",
        group2_name: str = "Treatment"
    ) -> pd.DataFrame:
        """
        DESeq2 analysis using pyDESeq2
        Extracted from: compute_deseq2_results() with production hardening
        """
        try:
            samples = sample_group1 + sample_group2
            conditions = [group1_name] * len(sample_group1) + [group2_name] * len(sample_group2)
            
            metadata = pd.DataFrame({'condition': conditions}, index=samples)
            count_data = count_matrix[samples].round().astype(int)
            count_data_transposed = count_data.T
            
            logger.info(f"Running DESeq2 analysis: {group1_name} vs {group2_name}")
            start_time = time.time()
            
            dds = DeseqDataSet(
                counts=count_data_transposed,
                metadata=metadata,
                design_factors='condition',
                ref_level=[group1_name]
            )
            
            dds.deseq2()
            
            stat_res = DeseqStats(
                dds,
                contrast=['condition', group2_name, group1_name]
            )
            stat_res.summary()
            results_df = stat_res.results_df
            
            results = pd.DataFrame({
                'logFC': results_df['log2FoldChange'],
                'p_value': results_df['pvalue'],
                'adj_p_value': results_df['padj'],
                'baseMean': results_df['baseMean'],
                'lfcSE': results_df['lfcSE'],
                'stat': results_df['stat']
            }, index=results_df.index)
            
            results['p_value'] = results['p_value'].fillna(1.0)
            results['adj_p_value'] = results['adj_p_value'].fillna(1.0)
            
            results['mean_group1'] = count_data[sample_group1].mean(axis=1)
            results['mean_group2'] = count_data[sample_group2].mean(axis=1)
            
            results = results.reset_index().rename(columns={'index': 'Gene'})
            
            elapsed = time.time() - start_time
            logger.info(f"DESeq2 analysis completed in {elapsed:.2f}s")
            
            return results
            
        except ImportError as e:
            logger.error(f"pyDESeq2 not available: {e}")
            raise
        except Exception as e:
            logger.error(f"DESeq2 analysis failed: {e}")
            raise
    
    @staticmethod
    def filter_and_sort_degs(
        results: pd.DataFrame,
        logFC_threshold: float = 1.0,
        p_value_threshold: float = 0.05
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Filter and sort significant DEGs
        Extracted from: filter_and_sort_degs()
        """
        p_col = (
            'adj_p_value'
            if 'adj_p_value' in results.columns
            else 'p_value'
        )
        
        significant_mask = (
            (np.abs(results['logFC']) > logFC_threshold) &
            (results[p_col] < p_value_threshold)
        )
        significant_genes = results[significant_mask].copy()
        
        significant_genes['direction'] = np.where(
            significant_genes['logFC'] > 0, 'upregulated', 'downregulated'
        )
        
        upregulated = significant_genes[
            significant_genes['logFC'] > 0
        ].sort_values('logFC', ascending=False)
        
        downregulated = significant_genes[
            significant_genes['logFC'] < 0
        ].sort_values('logFC', ascending=True)
        
        return upregulated, downregulated

    @staticmethod
    def generate_ma_plot_data(results: pd.DataFrame):
        """
        Generate MA plot data
        """

        ma_df = results.copy()

        ma_df["A"] = np.log2(
            ((ma_df["mean_group1"] + ma_df["mean_group2"]) / 2) + 1
        )

        return ma_df[["Gene", "A", "logFC", "p_value"]].to_dict("records")

    @staticmethod
    def generate_pca_data(
        count_matrix: pd.DataFrame,
        sample_group1: list,
        sample_group2: list,
        group1_name="Group 1",
        group2_name="Group 2"
    ):
        """
        Generate PCA coordinates for samples
        """

        count_matrix = DEGsAnalysisService.validate_and_clean_count_matrix(count_matrix)
    
        samples = sample_group1 + sample_group2
    
        expr = count_matrix[samples].copy()
    
        # Same transformation used in heatmap
        expr = np.log2(expr + 1)
    
        # PCA expects samples x genes
        X = expr.T
    
        pca = PCA(n_components=3)
    
        pcs = pca.fit_transform(X)
    
        explained = pca.explained_variance_ratio_ * 100
    
        pca_data = []
    
        for i, sample in enumerate(samples):
    
            group = (
                group1_name
                if sample in sample_group1
                else group2_name
            )
    
            pca_data.append({
                "sample": sample,
                "group": group,
                "pc1": float(pcs[i, 0]),
                "pc2": float(pcs[i, 1]),
                "pc3": float(pcs[i, 2])
            })
    
        return {
            "samples": pca_data,
            "pc1_variance": float(explained[0]),
            "pc2_variance": float(explained[1]),
            "pc3_variance": float(explained[2])
        }
    
    @staticmethod
    def run_analysis(
        count_matrix: pd.DataFrame,
        sample_group1: list,
        sample_group2: list,
        data_is_normalized: bool,
        analysis_method: str = "DESeq2",
        logFC_threshold: float = 1.0,
        p_value_threshold: float = 0.05
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Run complete DEGs analysis pipeline
        Returns: (all_results, upregulated, downregulated)
        """
        logger.info(f"Starting {analysis_method} analysis...")
        
        # Validate and clean
        count_matrix = DEGsAnalysisService.validate_and_clean_count_matrix(count_matrix)
        
        # Run analysis
        if analysis_method == "DESeq2" and not data_is_normalized:
            results = DEGsAnalysisService.compute_deseq2_results(
                count_matrix, sample_group1, sample_group2
            )
        else:
            # CPM normalization + t-test
            if not data_is_normalized:
                count_matrix = DEGsAnalysisService.normalize_to_cpm(count_matrix)
            results = DEGsAnalysisService.calculate_differential_expression_fast(
                count_matrix, sample_group1, sample_group2
            )
        
        # Filter
        upregulated, downregulated = DEGsAnalysisService.filter_and_sort_degs(
            results, logFC_threshold, p_value_threshold
        )
        
        logger.info(f"Analysis complete: {len(upregulated)} up, {len(downregulated)} down")
        
        return results, upregulated, downregulated
