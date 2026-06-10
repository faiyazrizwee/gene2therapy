
#Initialize project structure and setup script

#!/bin/bash

set -e

echo "🚀 Gene2Therapy Project Initialization"
echo "======================================"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p backend/app/{api,db,models,schemas,services,external_apis,core,middleware,utils,tests}
mkdir -p backend/docker
mkdir -p backend/migrations/versions
mkdir -p frontend/src/{components,services,stores,theme,types,hooks,pages}

# Backend setup
echo "🐍 Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Created virtual environment"
fi

source venv/bin/activate
pip install -q -r requirements.txt
echo "✅ Installed backend dependencies"

# Create .env if not exists
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created .env from template"
fi

cd ..

# Frontend setup
echo "📦 Setting up frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    npm install -q
    echo "✅ Installed frontend dependencies"
fi

# Create .env if not exists
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created .env from template"
fi

cd ..

echo ""
echo "✨ Setup complete!"
echo ""
echo "📖 Next steps:"
echo "  1. Update backend/.env with your NCBI_EMAIL"
echo "  2. Run: docker-compose -f backend/docker-compose.yml up -d"
echo "  3. Backend available at http://localhost:8000"
echo "  4. Frontend available at http://localhost:3000"
echo ""
echo "📚 Documentation: README.md"
