# EduBase Intelligence Service

ML and AI intelligence backend for the EduBase university platform.

## Features
- **Student Performance Risk**: GradientBoosting regression and transparent heuristic fallback with explainable factors.
- **Elective Recommender**: Hybrid recommendation combining student interests/course tags with collaborative peer grade vectors.
- **Placement Skill-gap Analysis**: Impact-weighted skill gap detection unlocking eligible placement drives.
- **Room Allocation**: OR-Tools CP-SAT timetable slot to room constraint solver minimizing wasted seats.
- **Campus Assistant**: Anthropic Claude agent with PostgreSQL/pgvector KB search and student data retrieval tools.

## Requirements
- Python 3.11+
- PostgreSQL with `pgvector`
- Supabase Auth

## Setup
```bash
pip install -e ".[dev]"
cp .env.example .env
uvicorn edubase_ml.main:app --reload --port 8000
```

## Testing
```bash
pytest -q
```
