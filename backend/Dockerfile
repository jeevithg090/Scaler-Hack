FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    WEB_CONCURRENCY=1

WORKDIR /app

RUN useradd --create-home appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ[\"PORT\"]}/api/health')" || exit 1

# Cloud Run injects $PORT. Keep WEB_CONCURRENCY=1 unless Firestore is enabled:
# the in-memory store is per-process.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY}"]
