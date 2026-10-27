FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir -e .

COPY edubase_ml ./edubase_ml

EXPOSE 8000

CMD ["uvicorn", "edubase_ml.main:app", "--host", "0.0.0.0", "--port", "8000"]
