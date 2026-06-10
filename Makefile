"""
Makefile for convenient project management
"""

.PHONY: help setup dev test clean docker-up docker-down

help:
	@echo "Gene2Therapy Project Commands"
	@echo "=============================="
	@echo "make setup        - Initialize project structure"
	@echo "make dev          - Start development servers"
	@echo "make test         - Run backend tests"
	@echo "make lint         - Run code quality checks"
	@echo "make docker-up    - Start Docker services"
	@echo "make docker-down  - Stop Docker services"
	@echo "make clean        - Clean build artifacts"

setup:
	@bash setup.sh

dev:
	@echo "Starting development servers..."
	@cd backend && uvicorn app.main:app --reload &
	@cd frontend && npm run dev

test:
	@cd backend && pytest --cov=app tests/

lint:
	@cd backend && black app/ && flake8 app/ && mypy app/

docker-up:
	@docker-compose -f backend/docker-compose.yml up -d
	@echo "Services started:"
	@echo "  Backend: http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"

docker-down:
	@docker-compose -f backend/docker-compose.yml down

clean:
	@rm -rf backend/__pycache__ backend/.pytest_cache backend/dist
	@rm -rf frontend/dist frontend/node_modules
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
