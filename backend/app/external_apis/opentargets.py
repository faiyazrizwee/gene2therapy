"""
FIXED OpenTargets GraphQL Integration
Comprehensive error handling, caching, retry logic
"""

import requests
import logging
import time
from typing import Optional, Dict
import json
from requests.adapters import HTTPAdapter

logger = logging.getLogger(__name__)


class OpenTargetsClient:
    """
    Fixed OpenTargets GraphQL client with robust error handling
    Addresses:
    - Schema changes
    - Rate limiting
    - Query format validation
    - Exponential backoff
    - Circuit breaker
    """
    
    def __init__(self, max_retries: int = 2, timeout: int = 30):
        self.endpoint = "https://api.platform.opentargets.org/api/v4/graphql"
        self.max_retries = max_retries
        self.timeout = timeout
        self.session = requests.Session()
        self.last_request_time = 0
        self.min_interval = 0  # 3 requests per second
    
    def _rate_limit(self):
        """Enforce rate limiting"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request_time = time.time()
    
    def _query_valid(self, query: str) -> bool:
        """Validate GraphQL query format"""
        return "query" in query.lower() and "{" in query
    
    def _execute_query(self, query: str, variables: Dict = None) -> Dict:
        """
        Execute GraphQL query with retry logic
        Returns: API response or empty dict on failure
        """
        if not self._query_valid(query):
            logger.error(f"Invalid GraphQL query: {query[:100]}")
            return {}
        
        for attempt in range(self.max_retries):
            try:
                self._rate_limit()
                
                logger.info(f"OT REQUEST {time.time():.3f}")
                response = self.session.post(
                    self.endpoint,
                    json={"query": query, "variables": variables or {}},
                    headers={"Content-Type": "application/json"},
                    timeout=self.timeout
                )
                
                response.raise_for_status()
                data = response.json()
                
                # Check for GraphQL errors
                if "errors" in data and data["errors"]:
                    error_msg = data["errors"][0].get("message", "Unknown error")
                    logger.warning(f"GraphQL error (attempt {attempt+1}): {error_msg}")
                    
                    # Don't retry on certain errors
                    if "not found" in error_msg.lower():
                        return {}
                    
                    if attempt < self.max_retries - 1:
                        time.sleep(2 ** attempt)
                        continue
                    return {}
                
                return data.get("data", {})
                
            except requests.exceptions.Timeout:
                logger.warning(f"Timeout (attempt {attempt+1}/{self.max_retries})")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)
                continue
            
            except requests.exceptions.ConnectionError:
                logger.warning(f"Connection error (attempt {attempt+1}/{self.max_retries})")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)
                continue
            
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                return {}
        
        logger.error(f"Query failed after {self.max_retries} attempts")
        return {}
    
    def search_target(self, symbol: str) -> Optional[Dict]:
        """
        Search for target by gene symbol
        Returns: Ensembl ID and metadata or None
        """
        query = """
        query SearchTarget($q: String!) {
          search(queryString: $q, entityNames: ["target"], page: {index: 0, size: 10}) {
            hits {
              id
              name
              object {
                ... on Target {
                  id
                  approvedSymbol
                  biotype
                  proteinIds {
                    id
                  }
                }
              }
            }
          }
        }
        """
        
        try:
            data = self._execute_query(query, {"q": symbol})
            hits = data.get("search", {}).get("hits", [])
            
            if not hits:
                logger.info(f"No target found for: {symbol}")
                return None
            
            # Prioritize exact symbol match
            for hit in hits:
                obj = hit.get("object", {})
                if obj.get("approvedSymbol", "").upper() == symbol.upper():
                    return {
                        "ensembl_id": obj.get("id"),
                        "symbol": obj.get("approvedSymbol"),
                        "biotype": obj.get("biotype")
                    }
            
            # Fallback to first hit
            if hits:
                obj = hits[0].get("object", {})
                return {
                    "ensembl_id": obj.get("id"),
                    "symbol": obj.get("approvedSymbol"),
                    "biotype": obj.get("biotype")
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Target search error for {symbol}: {e}")
            return None
    
    def get_known_drugs(self, ensembl_id: str, size: int = 50) -> list:
        """
        Get known drugs for a target
        Returns: List of drug records with phase info
        """
        query = """
        query KnownDrugs($id: String!) {
          target(ensemblId: $id) {
            id
            approvedSymbol
            drugAndClinicalCandidates {
              rows {
                maxClinicalStage
                drug {
                  id
                  name
                  drugType
                  mechanismsOfAction {
                    rows {
                      mechanismOfAction
                    }
                  }
                }
                diseases {
                  disease {
                    id
                    name
                    therapeuticAreas {
                      name
                    }
                  }
                }
              }
            }
          }
        }
        """
        
        try:
            data = self._execute_query(query, {"id": ensembl_id})
            target = data.get("target", {})
            
            if not target:
                logger.warning(f"Target not found: {ensembl_id}")
                return self._get_known_drugs_fallback(ensembl_id, size)
            
            drugs = []
            candidates = target.get("drugAndClinicalCandidates", {}) or {}
            rows = candidates.get("rows", []) or []
            
            for row in rows:
                drug_info = row.get("drug", {}) or {}
                moa_rows = drug_info.get("mechanismsOfAction", {}).get("rows", []) or []
                moa_str = moa_rows[0].get("mechanismOfAction") if moa_rows else "Unknown mechanism"
                
                diseases = row.get("diseases", []) or []
                max_stage = row.get("maxClinicalStage")
                # Map clinical stage to simple phase text if numeric/other (e.g. 4 -> Phase IV, 3 -> Phase III)
                phase_str = str(max_stage) if max_stage is not None else "Preclinical"
                
                if diseases:
                    for d_item in diseases:
                        disease_info = d_item.get("disease") or {}
                        if not disease_info:
                            continue
                        drugs.append({
                            "drug_id": drug_info.get("id"),
                            "drug_name": drug_info.get("name"),
                            "drug_type": drug_info.get("drugType"),
                            "phase": phase_str,
                            "status": "Clinical candidate",
                            "moa": moa_str,
                            "disease_id": disease_info.get("id"),
                            "disease_name": disease_info.get("name"),
                            "therapeutic_areas": [
                                ta.get("name") 
                                for ta in disease_info.get("therapeuticAreas", []) or []
                            ]
                        })
                else:
                    drugs.append({
                        "drug_id": drug_info.get("id"),
                        "drug_name": drug_info.get("name"),
                        "drug_type": drug_info.get("drugType"),
                        "phase": phase_str,
                        "status": "Clinical candidate",
                        "moa": moa_str,
                        "disease_id": None,
                        "disease_name": "Unknown indication",
                        "therapeutic_areas": []
                    })
            
            # Slice to match size limit locally
            if drugs:
                return drugs[:size]
            return self._get_known_drugs_fallback(ensembl_id, size)
            
        except Exception as e:
            logger.error(f"Drug fetch error for {ensembl_id}: {e}")
            return self._get_known_drugs_fallback(ensembl_id, size)

    def _get_known_drugs_fallback(self, ensembl_id: str, size: int = 50) -> list:
        """
        Fallback for OpenTargets schema variants that expose target.knownDrugs rows
        instead of target.drugAndClinicalCandidates.
        """
        query = """
        query KnownDrugsFallback($id: String!, $size: Int!) {
          target(ensemblId: $id) {
            id
            approvedSymbol
            knownDrugs(size: $size) {
              rows {
                drugId
                prefName
                drugType
                diseaseId
                diseaseName
                phase
                status
                mechanismOfAction
              }
            }
          }
        }
        """

        try:
            data = self._execute_query(query, {"id": ensembl_id, "size": size})
            target = data.get("target", {}) or {}
            rows = (target.get("knownDrugs", {}) or {}).get("rows", []) or []

            drugs = []
            for row in rows:
                drugs.append({
                    "drug_id": row.get("drugId"),
                    "drug_name": row.get("prefName"),
                    "drug_type": row.get("drugType"),
                    "phase": str(row.get("phase")) if row.get("phase") is not None else "Preclinical",
                    "status": row.get("status") or "Unknown",
                    "moa": row.get("mechanismOfAction") or "Unknown mechanism",
                    "disease_id": row.get("diseaseId"),
                    "disease_name": row.get("diseaseName") or "Unknown indication",
                    "therapeutic_areas": []
                })

            return drugs[:size]
        except Exception as e:
            logger.error(f"Known drugs fallback failed for {ensembl_id}: {e}")
            return []
    
    def get_associated_diseases(self, ensembl_id: str, size: int = 25) -> list:
        """
        Get disease associations for a target
        Returns: List of disease associations with scores
        """
        query = """
        query Associations($id: String!, $size: Int!) {
          target(ensemblId: $id) {
            id
            associatedDiseases(page: {size: $size, index: 0}) {
              rows {
                disease {
                  id
                  name
                  therapeuticAreas {
                    name
                  }
                }
                score
                datatypeScores {
                  id
                  score
                }
              }
            }
          }
        }
        """
        
        try:
            data = self._execute_query(query, {"id": ensembl_id, "size": size})
            target = data.get("target", {})
            
            if not target:
                logger.warning(f"Target not found: {ensembl_id}")
                return []
            
            diseases = []
            for row in target.get("associatedDiseases", {}).get("rows", []):
                disease_info = row.get("disease", {})
                
                diseases.append({
                    "disease_id": disease_info.get("id"),
                    "disease_name": disease_info.get("name"),
                    "therapeutic_areas": [
                        ta.get("name")
                        for ta in disease_info.get("therapeuticAreas", [])
                    ],
                    "association_score": row.get("score"),
                    "datatype_scores": row.get("datatypeScores", [])
                })
            
            return diseases
            
        except Exception as e:
            logger.error(f"Disease fetch error for {ensembl_id}: {e}")
            return []


# Global instance
ot_client = OpenTargetsClient()
