FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg libsndfile1 libpq-dev && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app
ENV PYTHONPATH=/app

COPY shared /app/shared
RUN pip install -e /app/shared

COPY processor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY processor/ .

RUN chown -R appuser:appuser /app
USER appuser

CMD ["celery", "-A", "celery_app", "worker", "--loglevel=info", "-c", "2"]
