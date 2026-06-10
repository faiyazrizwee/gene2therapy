# Gene2Therapy

Gene2Therapy is a web-based bioinformatics platform for differential gene expression analysis, pathway enrichment, and therapeutic target discovery. The platform combines a React frontend, FastAPI backend, and PostgreSQL database to provide an interactive environment for transcriptomics and functional genomics analyses.

---

## Features

### Differential Gene Expression Analysis

* Upload count matrices in CSV or TSV format
* Differential expression analysis using DESeq2
* Statistical filtering based on log fold change and p-value thresholds
* Interactive result exploration

### Pathway Enrichment Analysis

* KEGG pathway enrichment
* Functional annotation of differentially expressed genes
* Biological interpretation of gene sets

### Drug Discovery and Therapeutic Insights

* OpenTargets integration
* ChEMBL integration
* Drug-target association analysis
* Disease-gene relationship exploration

### Data Management

* PostgreSQL-based data persistence
* Automated daily cleanup for demo deployments
* Secure environment-based configuration

---

## Technology Stack

### Backend

* FastAPI
* SQLAlchemy
* PostgreSQL
* PyDESeq2
* Biopython
* APScheduler

### Frontend

* React
* TypeScript
* Material UI
* React Query
* Zustand
* Plotly.js
* Cytoscape.js

### External Resources

* NCBI Entrez
* KEGG REST API
* OpenTargets Platform
* ChEMBL

---

## Project Structure

```text
gene2therapy/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── external_apis/
│   │   ├── middleware/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── utils/
│   │   └── main.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

---

## Local Development

### Backend Setup

```bash
git clone https://github.com/faiyazrizwee/gene2therapy.git
cd gene2therapy/backend

python -m venv venv
source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env

uvicorn app.main:app --reload
```

Backend will be available at:

```text
http://localhost:8000
```

---

### Frontend Setup

```bash
cd ../frontend

npm install

cp .env.example .env

npm run dev
```

Frontend will be available at:

```text
http://localhost:3000
```

---

## Environment Variables

### Backend

```env
DATABASE_URL=
SECRET_KEY=
DEBUG=False

NCBI_EMAIL=
NCBI_API_KEY=
```

### Frontend

```env
VITE_API_URL=
VITE_APP_NAME=Gene2Therapy
```

---

## API Documentation

After starting the backend:

### Swagger UI

```text
http://localhost:8000/docs
```

### ReDoc

```text
http://localhost:8000/redoc
```

---

## Deployment

Current deployment architecture:

```text
Frontend  → Vercel
Backend   → Render
Database  → Render PostgreSQL
```

---

## Testing

```bash
cd backend

pytest
```

---

## Maintenance

The application includes an automated cleanup scheduler that:

* Removes uploaded temporary files
* Clears stored analysis results
* Helps maintain storage limits on free-tier deployments

---

## Contributors

**Md Faiyaz Rizwee**

GitHub: https://github.com/faiyazrizwee
LinkedIn: https://www.linkedin.com/in/md-faiyaz-rizwee-62024438b

---

## License

This project is released under the MIT License.
