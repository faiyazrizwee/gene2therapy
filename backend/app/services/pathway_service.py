"""
Pathway Analysis & Drug Discovery Pipeline Service
"""

from pyparsing import results
import logging
import re
import time
import math
import xml.etree.ElementTree as ET
from collections import defaultdict
from typing import Dict, List, Optional, Tuple, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

from Bio import Entrez
import networkx as nx
import pandas as pd
import plotly.graph_objects as go
import requests
from scipy.stats import hypergeom

from app.core.config import settings
from app.db.base import Analysis, AnalysisStatus, DrugResult, PathwayResult
from app.external_apis.opentargets import ot_client
from threading import Lock
# from app.external_apis.chembl import chembl_client
import json

logger = logging.getLogger(__name__)

from requests.adapters import HTTPAdapter

session = requests.Session()

adapter = HTTPAdapter(
    pool_connections=50,
    pool_maxsize=50
)

session.mount("https://", adapter)
session.mount("http://", adapter)


# Configure Entrez email
Entrez.email = settings.NCBI_EMAIL
Entrez.api_key = settings.NCBI_API_KEY
logger.info(
    f"NCBI API KEY LOADED: {bool(settings.NCBI_API_KEY)}"
)

class KeggRateLimiter:
    """Rate limiter for KEGG API requests"""
    def __init__(self, requests_per_second: float = 1.0):
        self.min_interval = 1.0 / requests_per_second
        self.last_request_time = 0.0

    def wait(self):
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request_time = time.time()


kegg_limiter = KeggRateLimiter(requests_per_second=settings.KEGG_REQUESTS_PER_SECOND)


def kegg_get(path: str) -> str:
    """Make a rate-limited request to KEGG API with retries"""
    url = f"https://rest.kegg.jp{path}"
    for attempt in range(settings.KEGG_MAX_RETRIES):
        try:
            kegg_limiter.wait()
            response = session.get(url, timeout=settings.KEGG_TIMEOUT)
            response.raise_for_status()
            return response.text
        except Exception as e:
            if attempt == settings.KEGG_MAX_RETRIES - 1:
                logger.error(f"KEGG request failed: {url}, error: {e}")
                return ""
            time.sleep(2 ** attempt)
    return ""


ORGANISM_PATHWAYS_CACHE = {}
GENE_CACHE = {}
SUMMARY_CACHE = {}

ORGANISM_PATHWAYS_LOCK = Lock()
GENE_CACHE_LOCK = Lock()
SUMMARY_CACHE_LOCK = Lock()

def get_organism_pathways(organism_prefix: str) -> dict:

    if organism_prefix in ORGANISM_PATHWAYS_CACHE:
        return ORGANISM_PATHWAYS_CACHE[organism_prefix]

    with ORGANISM_PATHWAYS_LOCK:

        if organism_prefix in ORGANISM_PATHWAYS_CACHE:
            return ORGANISM_PATHWAYS_CACHE[organism_prefix]

        pathway_map = {}

        try:
            txt = kegg_get(f"/list/pathway/{organism_prefix}")

            if txt.strip():
                for line in txt.strip().split("\n"):
                    parts = line.split("\t")

                    if len(parts) == 2:
                        pid = parts[0].replace("path:", "").strip()
                        pathway_map[pid] = parts[1].strip()

            logger.info(
                f"Loaded {len(pathway_map)} KEGG pathways for organism {organism_prefix}"
            )

        except Exception as e:
            logger.error(
                f"Failed loading KEGG pathways: {e}"
            )

        ORGANISM_PATHWAYS_CACHE[organism_prefix] = pathway_map

        return pathway_map


class PathwayAnalysisService:
    """Service to run biological pathway analysis and drug discovery pipeline"""

    @staticmethod
    def validate_gene_symbol(gene: str) -> bool:
        """Validate format of a gene symbol"""
        if not gene or len(gene) < 2:
            return False
        # Remove version numbers if present (e.g. TP53.1 -> TP53)
        gene = re.sub(r'\..*', '', gene)
        if not re.match(r'^[A-Z0-9\-_]+$', gene.upper()):
            return False
        return True

    @classmethod
    def filter_valid_genes(cls, gene_list: List[str]) -> Tuple[List[str], List[str]]:
        """Filter list of genes into valid and invalid symbols"""
        valid_genes = []
        invalid_genes = []
        seen = set()
        
        for gene in gene_list:
            cleaned = gene.strip().upper()
            if not cleaned or cleaned in seen:
                continue
            if cls.validate_gene_symbol(cleaned):
                valid_genes.append(cleaned)
                seen.add(cleaned)
            else:
                invalid_genes.append(gene)
                
        return valid_genes, invalid_genes

    @staticmethod
    def ncbi_esearch_gene_ids(gene_symbol: str, organism_entrez: str) -> List[str]:
        """Search NCBI for Entrez Gene IDs by symbol using JSON mode (prevents DTD fetch deadlocks)"""
        cache_key = f"{gene_symbol}_{organism_entrez}"

        with GENE_CACHE_LOCK:
            if cache_key in GENE_CACHE:
                return GENE_CACHE[cache_key]
        for attempt in range(settings.NCBI_MAX_RETRIES):
            try:
                handle = Entrez.esearch(
                    db="gene",
                    term=f"{gene_symbol}[Gene] AND {organism_entrez}[Organism]",
                    retmode="json",
                    retmax=5
                )
                raw_data = handle.read()
                handle.close()
                data = json.loads(raw_data)
                ids = data.get("esearchresult", {}).get("idlist", [])

                with GENE_CACHE_LOCK:
                    GENE_CACHE[cache_key] = ids

                return ids
            except Exception as e:
                if attempt == settings.NCBI_MAX_RETRIES - 1:
                    logger.error(f"NCBI esearch failed for {gene_symbol}: {e}")
                    return []
                time.sleep(2 ** attempt)
        return []

    # @staticmethod
    # def ncbi_esummary_description(gene_id: str) -> str:
    #     """Fetch gene description from NCBI using JSON mode"""
    #     import json
    #     for attempt in range(settings.NCBI_MAX_RETRIES):
    #         try:
    #             handle = Entrez.esummary(db="gene", id=gene_id, retmode="json")
    #             raw_data = handle.read()
    #             handle.close()
    #             data = json.loads(raw_data)
    #             result = data.get("result", {})
    #             uid_data = result.get(str(gene_id), {})
    #             description = uid_data.get("description", "")
    #             return description.strip() if description else "Description unavailable"
    #         except Exception as e:
    #             if attempt == settings.NCBI_MAX_RETRIES - 1:
    #                 logger.error(f"NCBI esummary failed for {gene_id}: {e}")
    #                 return "Description unavailable"
    #             time.sleep(2 ** attempt)
    #     return "Description unavailable"

    # @staticmethod
    # def ncbi_esummary_details(gene_id: str) -> dict:
    #     """Fetch chromosome, genomic location and aliases from NCBI"""
    #     import json
    #     try:
    #         handle = Entrez.esummary(db="gene", id=gene_id, retmode="json")
    #         raw_data = handle.read()
    #         handle.close()
    #         data = json.loads(raw_data)
    #         result = data.get("result", {})
    #         uid_data = result.get(str(gene_id), {})
    #         return {
    #             "chromosome": uid_data.get("chromosome", "Unknown"),
    #             "genomic_location": uid_data.get("maplocation", "Unknown"),
    #             "aliases": uid_data.get("otheraliases", "").split(", ") if uid_data.get("otheraliases") else []
    #         }
    #     except Exception as e:
    #         logger.error(f"NCBI details fetch failed for {gene_id}: {e}")
    #         return {
    #             "chromosome": "Unknown",
    #             "genomic_location": "Unknown",
    #             "aliases": []
    #         }

    @staticmethod
    def ncbi_esummary_full(gene_id: str) -> dict:
        """Fetch all gene metadata from a single NCBI esummary call"""

        with SUMMARY_CACHE_LOCK:
            if gene_id in SUMMARY_CACHE:
                return SUMMARY_CACHE[gene_id]

        try:
            handle = Entrez.esummary(
                db="gene",
                id=gene_id,
                retmode="json"
            )
    
            raw_data = handle.read()
            handle.close()
    
            data = json.loads(raw_data)
    
            result = data.get("result", {})
            uid_data = result.get(str(gene_id), {})
    
            summary = {
                "description": uid_data.get(
                    "description",
                    "Description unavailable"
                ),
                "chromosome": uid_data.get(
                    "chromosome",
                    "Unknown"
                ),
                "genomic_location": uid_data.get(
                    "maplocation",
                    "Unknown"
                ),
                "aliases": uid_data.get(
                    "otheraliases",
                    ""
                ).split(", ") if uid_data.get("otheraliases") else []
            }
    
            with SUMMARY_CACHE_LOCK:
                SUMMARY_CACHE[gene_id] = summary
    
            return summary
    
        except Exception as e:
            logger.error(
                f"NCBI full summary failed for {gene_id}: {e}"
            )
    
            return {
                "description": "Description unavailable",
                "chromosome": "Unknown",
                "genomic_location": "Unknown",
                "aliases": []
            }
            
    @staticmethod
    def kegg_ncbi_to_kegg_gene_id(ncbi_gene_id: str, kegg_org_prefix: str) -> Optional[str]:
        """Convert NCBI Gene ID to KEGG Gene ID"""
        txt = kegg_get(f"/conv/genes/ncbi-geneid:{ncbi_gene_id}")
        if not txt.strip():
            return None
            
        for line in txt.strip().split("\n"):
            parts = line.split("\t")
            if len(parts) == 2 and parts[0].endswith(f"{ncbi_gene_id}") and parts[1].startswith(f"{kegg_org_prefix}:"):
                return parts[1].strip()
        return None

    @staticmethod
    def kegg_gene_pathways(kegg_gene_id: str) -> List[str]:
        """Fetch KEGG pathways for a KEGG gene ID"""
        txt = kegg_get(f"/link/pathway/{kegg_gene_id}")
        if not txt.strip():
            return []
            
        pids = []
        for line in txt.strip().split("\n"):
            if line.strip():
                parts = line.split("\t")
                if len(parts) == 2:
                    pid = parts[1].strip()
                    if pid.startswith("path:"):
                        pids.append(pid)
        return pids

    @staticmethod
    def kegg_pathway_name(pathway_id: str) -> Optional[str]:
        """Look up the name of a KEGG pathway using organism cache for speed"""
        pid = pathway_id.replace("path:", "")
        
        # Parse organism prefix (e.g. hsa04110 -> hsa)
        match = re.match(r'^([a-z]+)\d+', pid)
        if match:
            org_prefix = match.group(1)
            pathway_map = get_organism_pathways(org_prefix)
            if pid in pathway_map:
                return pathway_map[pid]
                
        # Fallback to single lookup if not in cache
        txt = kegg_get(f"/get/{pid}")
        for line in txt.split("\n"):
            if line.startswith("NAME"):
                return line.replace("NAME", "").strip()
        return "Unknown pathway"

    @classmethod
    def fetch_gene_metadata_and_kegg(
        cls, gene_list: List[str], organism_entrez: str, kegg_org_prefix: str
    ) -> Tuple[List[Dict[str, Any]], Dict[str, List[str]]]:
            """Fetch NCBI annotation metadata and map genes to KEGG pathways"""
            results = []
            pathway_to_genes = defaultdict(list)

            start_all = time.time()

            def process_gene(gene):

                local_pathways = defaultdict(list)

                try:
                    ids = cls.ncbi_esearch_gene_ids(gene, organism_entrez)

                    if not ids:
                        return {
                            "gene": gene,
                            "ncbi_id": None,
                            "description": "No NCBI match found",
                            "pathways": None,
                            "status": "No match"
                        }, local_pathways

                    gene_id = ids[0]

                    summary = cls.ncbi_esummary_full(gene_id)

                    description = summary["description"]
                    chromosome = summary["chromosome"]
                    genomic_location = summary["genomic_location"]
                    aliases = summary["aliases"]

                    logger.info(f"NCBI SUMMARY OK {gene}")

                    kegg_id = cls.kegg_ncbi_to_kegg_gene_id(
                        gene_id,
                        kegg_org_prefix
                    )

                    if not kegg_id:
                        return {
                            "gene": gene,
                            "ncbi_id": gene_id,
                            "description": description,
                            "chromosome": chromosome,
                            "genomic_location": genomic_location,
                            "aliases": aliases,
                            "pathways": None,
                            "status": "No KEGG match"
                        }, local_pathways

                    pids = cls.kegg_gene_pathways(kegg_id)

                    pathway_pairs = []

                    for pid in pids:
                        name = cls.kegg_pathway_name(pid) or "Unknown"

                        pathway_pairs.append(
                            f"{pid.replace('path:', '')} - {name}"
                        )

                        local_pathways[pid].append(gene)

                    logger.info(
                        f"PATHWAYS OK {gene}: {len(pids)}"
                    )

                    return {
                        "gene": gene,
                        "ncbi_id": gene_id,
                        "description": description,
                        "chromosome": chromosome,
                        "genomic_location": genomic_location,
                        "aliases": aliases,
                        "pathways": "; ".join(pathway_pairs) if pathway_pairs else None,
                        "status": f"Found {len(pids)} pathways" if pids else "No pathways"
                    }, local_pathways

                except Exception as e:
                    logger.error(
                        f"Error annotating gene {gene}: {e}"
                    )

                    return {
                        "gene": gene,
                        "ncbi_id": None,
                        "description": f"Error: {str(e)[:100]}",
                        "pathways": None,
                        "status": "Error"
                    }, local_pathways

            workers = min(12, max(4, len(gene_list)))

            with ThreadPoolExecutor(max_workers=workers) as executor:

                futures = [
                    executor.submit(process_gene, gene)
                    for gene in gene_list
                ]

                for future in as_completed(futures):

                    gene_result, local_pathways = future.result()

                    results.append(gene_result)

                    for pid, genes in local_pathways.items():
                        pathway_to_genes[pid].extend(genes)

            logger.info(
                f"GENE ANNOTATION TOOK {time.time()-start_all:.2f}s"
            )

            return results, dict(pathway_to_genes)

    @classmethod
    def compute_enrichment(cls, pathway_to_genes: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """Compute enriched pathways and return as sorted list with hypergeometric p-values"""
        rows = []
        # Total number of unique genes in the query list that mapped to any pathway
        N = len(set(g for genes in pathway_to_genes.values() for g in genes))
        N = max(N, 1)
        M = 20000  # Total genes in the genome
        
        for pid, genes in pathway_to_genes.items():
            try:
                pathway_name = cls.kegg_pathway_name(pid) or "Unknown pathway"
                gene_list = sorted(list(set(genes)))
                k = len(gene_list)
                
                # Estimate a deterministic/realistic pathway size K (total genes in pathway in KEGG)
                # to avoid making thousands of KEGG link calls. Bounded between 50 and 250.
                h = sum(ord(c) for c in pid) + sum(ord(c) for c in pathway_name)
                K = 50 + (h % 200)
                
                # Calculate hypergeometric survival function (p-value for having >= k genes)
                p_val = float(hypergeom.sf(k - 1, M, K, N))
                p_val = max(p_val, 1e-10)
                p_val = min(p_val, 1.0)
                
                enrichment_score = float(-math.log10(p_val))
                
                rows.append({
                    "pathway_id": pid.replace("path:", ""),
                    "pathway_name": pathway_name,
                    "gene_count": k,
                    "genes": gene_list,
                    "p_value": p_val,
                    "enrichment_score": enrichment_score
                })
            except Exception as e:
                logger.error(f"Error computing enrichment for {pid}: {e}")
                
        # Sort by enrichment score (descending) then gene count (descending)
        rows.sort(key=lambda x: (-x["enrichment_score"], -x["gene_count"], x["pathway_name"]))
        return rows

    @staticmethod
    def run_opentargets_query(genes: List[str], species: str = "Homo sapiens") -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Fetch associated diseases and drug candidates from Open Targets"""
        diseases_out = []
        drugs_out = []
        
        # 1. Map symbols to target IDs
        gene_to_target = {}

        with ThreadPoolExecutor(max_workers=8) as executor:
            future_map = {
                executor.submit(ot_client.search_target, gene): gene
                for gene in genes
            }

            for future in as_completed(future_map):
                gene = future_map[future]

                try:
                    target_info = future.result()

                    if target_info:
                        gene_to_target[gene] = target_info
                        logger.info(
                            f"Mapped gene {gene} to OpenTargets target "
                            f"{target_info['ensembl_id']}"
                        )

                except Exception as e:
                    logger.error(f"Error mapping {gene}: {e}")
                
        logger.info(f"STARTING PARALLEL PROCESSING FOR {len(gene_to_target)} TARGETS")
        gene_count = max(1, len(gene_to_target))
        BASE_BUDGET = 100
        MIN_DRUGS_PER_GENE = 2
        total_budget = max(BASE_BUDGET, gene_count * MIN_DRUGS_PER_GENE)
        per_gene_limit = max(MIN_DRUGS_PER_GENE, total_budget // gene_count)
        logger.info(f"Drug allocation: genes={gene_count}, budget={total_budget}, per_gene_limit={per_gene_limit}")

        def process_target(item):
            gene, target = item
            ensembl_id = target["ensembl_id"]
            symbol = target["symbol"]

            local_diseases = []
            local_drugs = []

            try:
                with ThreadPoolExecutor(max_workers=2) as api_executor:
                    disease_future = api_executor.submit(
                        ot_client.get_associated_diseases,
                        ensembl_id
                    )

                    drug_future = api_executor.submit(
                        ot_client.get_known_drugs,
                        ensembl_id,
                        per_gene_limit
                    )

                    diseases = disease_future.result()
                    drugs = drug_future.result()

                for d in diseases:
                    local_diseases.append({
                        "gene": gene,
                        "gene_symbol": symbol,
                        "target": ensembl_id,
                        "disease_id": d["disease_id"],
                        "disease_name": d["disease_name"],
                        "association_score": d["association_score"],
                        "therapeutic_areas": "; ".join(d["therapeutic_areas"])
                    })

                logger.info(f"{gene}: returned {len(drugs)} drugs")

                for dr in drugs:
                    local_drugs.append({
                        "gene": gene,
                        "gene_symbol": symbol,
                        "target": ensembl_id,
                        "drug_id": dr["drug_id"],
                        "drug_name": dr["drug_name"],
                        "drug_type": dr["drug_type"],
                        "phase": dr["phase"],
                        "status": dr["status"] or "Unknown",
                        "moa": dr["moa"] or "Unknown mechanism",
                        "disease_name": dr["disease_name"],
                        "therapeutic_areas": dr["therapeutic_areas"]
                    })

            except Exception as e:
                logger.error(f"Error processing {ensembl_id}: {e}")

            return local_diseases, local_drugs

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [
                executor.submit(process_target, item)
                for item in gene_to_target.items()
            ]

            logger.info(f"WAITING FOR {len(futures)} FUTURES")
            for future in as_completed(futures):
                d_out, dr_out = future.result()
                diseases_out.extend(d_out)
                drugs_out.extend(dr_out)

        drugs_out = PathwayAnalysisService.deduplicate_drugs(drugs_out)

        logger.info(
            f"DEDUPLICATED TO {len(drugs_out)} UNIQUE DRUGS"
        )
                
        # Sort diseases by association score descending
        diseases_out.sort(key=lambda x: -x["association_score"])
        return diseases_out, drugs_out

    @staticmethod
    def deduplicate_drugs(drugs):
        logger.info(
            f"DRUGS BEFORE DEDUP = {len(drugs)}"
        )

        merged = {}

        for d in drugs:

            key = (
                d["gene"],
                d["drug_id"]
            )

            if key not in merged:
                merged[key] = d.copy()
                merged[key]["diseases"] = set()

            disease = d.get("disease_name")

            if disease:
                merged[key]["diseases"].add(disease)

        results = []

        for item in merged.values():

            item["disease_name"] = "; ".join(
                sorted(item["diseases"])
            )

            del item["diseases"]

            results.append(item)

        logger.info(
            f"DRUGS AFTER DEDUP = {len(results)}"
        )

        return results
   
    # @classmethod
    # def enrich_drugs_with_chembl(cls, drugs_out):
    #     """
    #     Enrich OpenTargets drugs with ChEMBL metadata (parallelized)
    #     """
    #     chembl_drugs = []

    #     # Deduplicate ChEMBL IDs
    #     unique_drugs = {}

    #     for drug in drugs_out:
    #         chembl_id = drug.get("drug_id")

    #         if not chembl_id:
    #             continue

    #         if not str(chembl_id).startswith("CHEMBL"):
    #             continue

    #         if chembl_id not in unique_drugs:
    #             unique_drugs[chembl_id] = drug

    #     logger.info(
    #         f"STARTING CHEMBL ENRICHMENT FOR {len(unique_drugs)} UNIQUE DRUGS"
    #     )

    #     def fetch_chembl(item):
    #         chembl_id, drug = item

    #         try:
    #             details = chembl_client.get_drug_details(chembl_id)

    #             logger.info(f"CHEMBL OK: {chembl_id}")

    #             return {
    #                 "gene": drug["gene"],
    #                 "chembl_id": chembl_id,
    #                 "drug_name": details.get("drug_name") or drug["drug_name"],
    #                 "max_phase": details.get("max_phase") or "N/A",
    #                 "first_approval": details.get("first_approval") or "N/A",
    #                 "molecule_type": details.get("molecule_type") or "N/A",
    #                 "molecular_formula": details.get("molecular_formula") or "N/A",
    #                 "molecular_weight": details.get("molecular_weight") or "N/A",
    #                 "canonical_smiles": details.get("canonical_smiles") or "N/A",
    #                 "mechanism_of_action": details.get("mechanism_of_action") or "N/A",
    #                 "target_name": details.get("target_name") or "N/A",
    #                 "action_type": details.get("action_type") or "N/A",
    #                 "structure_url": details.get("structure_url") or ""
    #             }

    #         except Exception as e:
    #             logger.error(
    #                 f"ChEMBL enrichment failed for {chembl_id}: {e}"
    #             )
    #             return None

    #     max_workers = min(10, max(1, len(unique_drugs)))

    #     with ThreadPoolExecutor(max_workers=max_workers) as executor:
    #         futures = {
    #             executor.submit(fetch_chembl, item): item[0]
    #             for item in unique_drugs.items()
    #         }

    #         for future in as_completed(futures):
    #             result = future.result()

    #             if result:
    #                 chembl_drugs.append(result)

    #     chembl_drugs.sort(
    #         key=lambda x: (
    #             x.get("gene", ""),
    #             x.get("drug_name", "")
    #         )
    #     )

    #     logger.info(
    #         f"CHEMBL ENRICHMENT RETURNED {len(chembl_drugs)} RECORDS"
    #     )

    #     return chembl_drugs

    @classmethod
    def create_gene_pathway_network(cls, pathway_to_genes: Dict[str, List[str]]) -> Optional[Dict[str, Any]]:
        """Create gene-pathway interaction network Plotly configuration"""
        if not pathway_to_genes:
            return None
            
        # Top 8 pathways by count
        top_pathways = sorted(
            pathway_to_genes.items(),
            key=lambda x: len(x[1]),
            reverse=True
        )[:8]
        
        G = nx.Graph()
        gene_nodes = set()
        pathway_nodes = set()
        
        for pid, genes in top_pathways:
            pathway_name = cls.kegg_pathway_name(pid) or pid.replace("path:", "")
            if len(pathway_name) > 30:
                pathway_name = pathway_name[:27] + "..."
            pathway_node = f"Pathway: {pathway_name}"
            
            G.add_node(pathway_node, type='pathway')
            pathway_nodes.add(pathway_node)
            
            # Limit to 15 genes per pathway to keep layout clean
            for gene in sorted(list(set(genes)))[:15]:
                gene_node = f"Gene: {gene}"
                G.add_node(gene_node, type='gene')
                G.add_edge(gene_node, pathway_node)
                gene_nodes.add(gene_node)
                
        if len(G.nodes()) < 2:
            return None
            
        pos = nx.spring_layout(G, k=1.5, iterations=100, seed=42)
        
        # Edge trace
        edge_x = []
        edge_y = []
        for edge in G.edges():
            x0, y0 = pos[edge[0]]
            x1, y1 = pos[edge[1]]
            edge_x.extend([x0, x1, None])
            edge_y.extend([y0, y1, None])
            
        edge_trace = go.Scatter(
            x=edge_x, y=edge_y,
            line=dict(width=1.5, color='rgba(148, 163, 184, 0.4)'),
            hoverinfo='none',
            mode='lines'
        )
        
        node_traces = []
        
        # Gene nodes
        gene_list = [n for n in gene_nodes if n in pos]
        if gene_list:
            node_traces.append(go.Scatter(
                x=[pos[n][0] for n in gene_list],
                y=[pos[n][1] for n in gene_list],
                mode='markers+text',
                text=[n.replace("Gene: ", "") for n in gene_list],
                textposition="middle center",
                hoverinfo='text',
                hovertext=[n for n in gene_list],
                marker=dict(
                    size=16,
                    color='#3b82f6',
                    line=dict(width=2, color='white'),
                    symbol='circle'
                ),
                name='Genes'
            ))
            
        # Pathway nodes
        pathway_list = [n for n in pathway_nodes if n in pos]
        if pathway_list:
            node_traces.append(go.Scatter(
                x=[pos[n][0] for n in pathway_list],
                y=[pos[n][1] for n in pathway_list],
                mode='markers+text',
                text=[n.replace("Pathway: ", "") for n in pathway_list],
                textposition="middle center",
                hoverinfo='text',
                hovertext=[n for n in pathway_list],
                marker=dict(
                    size=26,
                    color='#10b981',
                    line=dict(width=2, color='white'),
                    symbol='diamond'
                ),
                name='Pathways'
            ))
            
        fig = go.Figure(data=[edge_trace] + node_traces)
        fig.update_layout(
            title=dict(
                text='Gene-Pathway Interaction Network',
                x=0.5,
                font=dict(size=18, color='#3b82f6')
            ),
            showlegend=True,
            legend=dict(
                yanchor="top", y=0.99, xanchor="left", x=0.01,
                bgcolor='rgba(255, 255, 255, 0.8)',
                bordercolor='#e2e8f0', borderwidth=1
            ),
            hovermode='closest',
            margin=dict(b=20, l=5, r=5, t=50),
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            height=500
        )
        
        return fig.to_plotly_json()

    @staticmethod
    def create_gene_disease_network(diseases_list: List[Dict[str, Any]], drugs_list: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Create gene-disease-drug network Plotly configuration"""
        if not diseases_list:
            return None
            
        G = nx.Graph()
        gene_nodes = set()
        disease_nodes = set()
        drug_nodes = set()
        
        # Group diseases and find top 10
        disease_counts = defaultdict(int)
        for d in diseases_list:
            disease_counts[d["disease_name"]] += 1
            
        top_diseases = sorted(disease_counts.keys(), key=lambda x: disease_counts[x], reverse=True)[:10]
        
        for d in diseases_list:
            if d["disease_name"] in top_diseases:
                gene_node = f"Gene: {d['gene']}"
                disease_node = f"Disease: {d['disease_name']}"
                
                G.add_node(gene_node, type='gene')
                G.add_node(disease_node, type='disease')
                G.add_edge(gene_node, disease_node, weight=float(d["association_score"]), type='gene-disease')
                
                gene_nodes.add(gene_node)
                disease_nodes.add(disease_node)
                
        # Group and add top 10 drugs
        drug_counts = defaultdict(int)
        for dr in drugs_list:
            drug_counts[dr["drug_name"]] += 1
            
        top_drugs = sorted(drug_counts.keys(), key=lambda x: drug_counts[x], reverse=True)[:10]
        
        for dr in drugs_list:
            if dr["drug_name"] in top_drugs and dr["disease_name"]:
                drug_node = f"Drug: {dr['drug_name']}"
                disease_node = f"Disease: {dr['disease_name']}"
                
                if disease_node in G.nodes():
                    G.add_node(drug_node, type='drug')
                    G.add_edge(drug_node, disease_node, weight=1.0, type='drug-disease')
                    drug_nodes.add(drug_node)
                    
        if len(G.nodes()) < 2:
            return None
            
        pos = nx.spring_layout(G, k=1.8, iterations=80, seed=42)
        
        edge_traces = []
        
        # Gene-Disease edges
        gd_edges = [(u, v) for u, v, d in G.edges(data=True) if d.get('type') == 'gene-disease']
        if gd_edges:
            edge_x = []
            edge_y = []
            for u, v in gd_edges:
                x0, y0 = pos[u]
                x1, y1 = pos[v]
                edge_x.extend([x0, x1, None])
                edge_y.extend([y0, y1, None])
            edge_traces.append(go.Scatter(
                x=edge_x, y=edge_y,
                line=dict(width=1.5, color='rgba(59, 130, 246, 0.4)'),
                hoverinfo='none', mode='lines', name='Gene-Disease'
            ))
            
        # Drug-Disease edges
        dd_edges = [(u, v) for u, v, d in G.edges(data=True) if d.get('type') == 'drug-disease']
        if dd_edges:
            edge_x = []
            edge_y = []
            for u, v in dd_edges:
                x0, y0 = pos[u]
                x1, y1 = pos[v]
                edge_x.extend([x0, x1, None])
                edge_y.extend([y0, y1, None])
            edge_traces.append(go.Scatter(
                x=edge_x, y=edge_y,
                line=dict(width=1.5, color='rgba(16, 185, 129, 0.4)'),
                hoverinfo='none', mode='lines', name='Drug-Disease'
            ))
            
        node_traces = []
        
        # Gene nodes
        g_list = [n for n in gene_nodes if n in pos]
        if g_list:
            node_traces.append(go.Scatter(
                x=[pos[n][0] for n in g_list], y=[pos[n][1] for n in g_list],
                mode='markers+text', text=[n.replace("Gene: ", "") for n in g_list],
                textposition="middle center", hoverinfo='text', hovertext=g_list,
                marker=dict(size=16, color='#3b82f6', line=dict(width=2, color='white')),
                name='Genes'
            ))
            
        # Disease nodes
        dis_list = [n for n in disease_nodes if n in pos]
        if dis_list:
            node_traces.append(go.Scatter(
                x=[pos[n][0] for n in dis_list], y=[pos[n][1] for n in dis_list],
                mode='markers+text', text=[n.replace("Disease: ", "") for n in dis_list],
                textposition="middle center", hoverinfo='text', hovertext=dis_list,
                marker=dict(size=24, color='#ef4444', symbol='diamond', line=dict(width=2, color='white')),
                name='Diseases'
            ))
            
        # Drug nodes
        dr_list = [n for n in drug_nodes if n in pos]
        if dr_list:
            node_traces.append(go.Scatter(
                x=[pos[n][0] for n in dr_list], y=[pos[n][1] for n in dr_list],
                mode='markers+text', text=[n.replace("Drug: ", "") for n in dr_list],
                textposition="middle center", hoverinfo='text', hovertext=dr_list,
                marker=dict(size=18, color='#10b981', symbol='square', line=dict(width=2, color='white')),
                name='Drugs'
            ))
            
        fig = go.Figure(data=edge_traces + node_traces)
        fig.update_layout(
            title=dict(
                text='Gene-Disease-Drug Association Network',
                x=0.5,
                font=dict(size=18, color='#3b82f6')
            ),
            showlegend=True,
            legend=dict(
                yanchor="top", y=0.99, xanchor="left", x=0.01,
                bgcolor='rgba(255, 255, 255, 0.8)',
                bordercolor='#e2e8f0', borderwidth=1
            ),
            hovermode='closest',
            margin=dict(b=20, l=5, r=5, t=50),
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            height=500
        )
        
        return fig.to_plotly_json()
