FROM python:3.11-slim

RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONPATH=/app

COPY shared /app/shared
RUN pip install -e /app/shared

COPY api-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api-service/ .

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --reload"]
