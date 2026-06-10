import pandas as pd
import numpy as np
import os

def generate_mock_counts(output_path: str):
    np.random.seed(42)
    genes = [f"GENE_{i:03d}" for i in range(1, 101)]
    samples = ["Control_1", "Control_2", "Control_3", "Treatment_1", "Treatment_2", "Treatment_3"]
    
    data = {}
    for sample in samples:
        data[sample] = []
        
    for i, gene in enumerate(genes):
        # i is 0-indexed: 0 to 99
        if i < 15:
            # Upregulated in Treatment
            control_mean = 200
            treatment_mean = 2000
        elif i < 30:
            # Downregulated in Treatment
            control_mean = 2000
            treatment_mean = 200
        else:
            # Not differentially expressed
            control_mean = 800
            treatment_mean = 800
            
        for s in samples:
            mean = control_mean if "Control" in s else treatment_mean
            # Negative binomial or simple Poisson
            val = np.random.poisson(mean)
            # Ensure no zeros for DESeq2 stability
            val = max(1, val)
            data[s].append(val)
            
    df = pd.DataFrame(data, index=genes)
    df.index.name = "Gene"
    df.to_csv(output_path)
    print(f"✅ Generated mock counts dataset at: {output_path}")

if __name__ == "__main__":
    output_dir = os.path.dirname(os.path.abspath(__file__))
    generate_mock_counts(os.path.join(output_dir, "mock_counts.csv"))
