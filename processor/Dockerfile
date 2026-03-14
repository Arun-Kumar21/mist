FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg libsndfile1 libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONPATH=/app

COPY shared /app/shared
RUN pip install -e /app/shared

COPY processor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY processor/ .

CMD ["celery", "-A", "celery_app", "worker", "--loglevel=info", "-c", "2"]
