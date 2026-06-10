import requests
from concurrent.futures import ThreadPoolExecutor
import logging

logger = logging.getLogger(__name__)

class ChEMBLClient:
    BASE_URL = "https://www.ebi.ac.uk/chembl/api/data"
    def __init__(self):
        self.session = requests.Session()


    def get_molecule(self, chembl_id):
        try:
            logger.info(f"CHEMBL REQUEST {chembl_id}")
            r = self.session.get(
                f"{self.BASE_URL}/molecule/{chembl_id}.json",
                timeout=5
            )
            if r.status_code == 200:
                return r.json()
        except Exception as e:
            logger.error(f"ChEMBL molecule error: {e}")
        return {}

    def get_mechanism(self, chembl_id):
        try:
            logger.info(f"CHEMBL REQUEST {chembl_id}")
            r = self.session.get(
                f"{self.BASE_URL}/mechanism.json?molecule_chembl_id={chembl_id}",
                timeout=5
            )
            if r.status_code == 200:
                return r.json()
        except Exception as e:
            logger.error(f"ChEMBL mechanism error: {e}")
        return {}

    def get_drug_details(self, chembl_id):
        molecule = self.get_molecule(chembl_id)
        mechanism = self.get_mechanism(chembl_id)

        mechs = mechanism.get("mechanisms", [])
        mech = mechs[0] if mechs else {}

        props = molecule.get("molecule_properties", {}) or {}

        return {
            "chembl_id": chembl_id,
            "drug_name": molecule.get("pref_name"),
            "max_phase": molecule.get("max_phase"),
            "first_approval": molecule.get("first_approval"),
            "molecule_type": molecule.get("molecule_type"),
            "molecular_formula": props.get("full_molformula"),
            "molecular_weight": props.get("full_mwt"),
            "canonical_smiles": (
                molecule.get("molecule_structures", {}) or {}
            ).get("canonical_smiles"),
            "mechanism_of_action": mech.get("mechanism_of_action"),
            "target_name": mech.get("target_name"),
            "action_type": mech.get("action_type"),
            "structure_url":
                f"https://www.ebi.ac.uk/chembl/api/data/image/{chembl_id}.svg"
        }

chembl_client = ChEMBLClient()
