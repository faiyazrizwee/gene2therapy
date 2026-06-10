"""
Project README
"""

# Gene2Therapy: Integrated Gene Analysis Platform

Modernized bioinformatics platform for differential expression analysis, pathway enrichment, and drug discovery with React + FastAPI + PostgreSQL architecture.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose (recommended)
- Python 3.11+ (for local development)
- Node.js 18+ (for frontend development)

### Option 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone <repo-url> && cd gene2therapy

# Setup environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start all services
docker-compose -f backend/docker-compose.yml up -d

# Services running:
# - Backend API: http://localhost:8000
# - Frontend: http://localhost:3000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

Visit http://localhost:3000 to access the application.

### Option 2: Local Development

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

**Frontend Setup:**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## 📋 Project Structure

```
gene2therapy/
├── backend/
│   ├── app/
│   │   ├── api/endpoints/analyses/
│   │   │   └── degs.py          # DEGs endpoints (Phase 1)
│   │   ├── external_apis/
│   │   │   └── opentargets.py   # FIXED OpenTargets client
│   │   ├── services/
│   │   │   └── degs_service.py  # DEGs analysis logic
│   │   ├── db/
│   │   │   ├── base.py          # SQLAlchemy models
│   │   │   └── session.py       # DB session management
│   │   ├── main.py              # FastAPI app entry
│   │   └── core/config.py       # Configuration
│   ├── docker-compose.yml       # Full stack compose
│   ├── requirements.txt         # Python dependencies
│   └── docker/Dockerfile        # Python image
├── frontend/
│   ├── src/
│   │   ├── components/degs/     # DEGs UI components
│   │   ├── services/api.ts      # API client
│   │   ├── stores/              # Zustand state
│   │   ├── theme/               # MUI theme
│   │   └── App.tsx              # Root component
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
└── README.md
```

## 🔬 Phase 1: DEGs Analysis

### Endpoints

**Upload Count Matrix**
```bash
POST /api/v1/degs/upload
- Accept: CSV/TSV files
- Returns: {filename, genes, samples, sample_names}
```

**Start Analysis**
```bash
POST /api/v1/degs/analyze
{
  "project_id": 1,
  "sample_group1": ["s1", "s2", "s3"],
  "sample_group2": ["s4", "s5", "s6"],
  "analysis_method": "DESeq2",
  "logFC_threshold": 1.0,
  "p_value_threshold": 0.05
}
- Returns: {analysis_id, status: "pending"}
```

**Get Results**
```bash
GET /api/v1/degs/results/{analysis_id}
- Returns: {analysis_id, status, results[], summary}
```

## 🔧 Configuration

### Backend Environment (.env)
```
DEBUG=True
DATABASE_URL=postgresql://user:pass@localhost:5432/gene2therapy
REDIS_URL=redis://localhost:6379/0
NCBI_EMAIL=your_email@example.com
SECRET_KEY=your-secret-key
```

### Frontend Environment (.env)
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=Gene2Therapy
```

## 📊 Database Schema

### Key Tables
- **users** - User authentication
- **projects** - Analysis projects
- **analyses** - Analysis jobs (DEGs, Pathway, Drugs)
- **deg_results** - Differential expression results
- **pathway_results** - Pathway enrichment data
- **drug_results** - Drug discovery matches
- **api_cache** - Response caching (Redis)

## 🔄 Phase Roadmap

### Phase 1: ✅ DEGs Analysis (Current)
- Count matrix upload (CSV/TSV)
- DESeq2 and t-test analysis methods
- Async processing with background tasks
- Result storage and retrieval

### Phase 2: Pathway Enrichment
- KEGG pathway queries
- Gene set enrichment analysis
- Network visualization
- Biological annotation

### Phase 3: Drug Discovery
- OpenTargets integration (FIXED with retry logic)
- Drug-target interactions
- Clinical trial phase tracking
- Disease associations

### Phase 4: Polish & Deployment
- Testing infrastructure (pytest)
- CI/CD pipeline (GitHub Actions)
- Circuit breaker pattern (OpenTargets)
- Production Docker setup
- Comprehensive documentation

## 🛠️ Development

### Running Tests
```bash
cd backend
pytest --cov=app tests/
```

### Code Quality
```bash
cd backend
black app/
flake8 app/
mypy app/
```

### Database Migrations
```bash
cd backend
alembic upgrade head
```

## 📖 API Documentation

Interactive API docs available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## ⚙️ Key Features

✨ **Architecture**
- Service-layer pattern for business logic
- Complete Python code reuse from Streamlit
- 100% async API with FastAPI
- Type-safe with TypeScript frontend

🗄️ **Data Persistence**
- PostgreSQL for analysis storage
- Redis for API response caching
- Automatic schema management (Alembic)

🔌 **External APIs**
- NCBI Entrez (2 req/s)
- KEGG REST (1 req/s)
- OpenTargets GraphQL (3 req/s with exponential backoff)

🎨 **Frontend**
- Material-UI v5 components
- React Query for data fetching
- Zustand for state management
- Vite for fast development

## 🐛 Troubleshooting

**Database Connection Error**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Reset database
docker-compose down -v
docker-compose up -d db
```

**API Not Responding**
```bash
# Check backend logs
docker logs gene2therapy_backend

# Verify health
curl http://localhost:8000/health
```

**Frontend Build Issues**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📝 License

(Add your license here)

## 👥 Contributors

Gene2Therapy Team

---

**Last Updated:** January 2024
**Version:** 1.0.0 (Phase 1)
