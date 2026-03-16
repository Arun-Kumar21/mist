# MIST

A self-hosted music streaming platform. Upload audio files and they are transcoded into AES-128 encrypted HLS streams, served from S3, and playable in the browser with per-user daily listening quotas.

## Stack

- **Frontend** — Next.js 16 (App Router), TypeScript, shadcn UI, Tailwind CSS, Zustand
- **API** — FastAPI, SlowAPI rate limiting, JWT auth, SQLAlchemy
- **Upload service** — FastAPI, S3 presigned POST, Celery task dispatch
- **Processor** — Celery worker, FFmpeg, librosa, pgvector embeddings
- **Database** — PostgreSQL with pgvector extension
- **Queue** — Redis (Celery broker and result backend)
- **Storage** — AWS S3 (original uploads and HLS output)

## Features

- Email-based registration and login with bcrypt passwords and JWT tokens (7-day expiry)
- Multi-bitrate HLS transcoding at 64 kbps, 128 kbps, and 192 kbps
- AES-128 encryption on all HLS segments; keys are served only to authenticated users
- Direct-to-S3 upload via presigned POST (max 50 MB), keeping file bytes off the API
- Async processing pipeline with Celery; job status polling until completion
- Audio feature extraction using librosa (MFCCs, spectral centroid, chroma, tempo, etc.)
- 40-dimensional normalized audio embeddings stored in pgvector for similarity search
- Content-based similar tracks endpoint using cosine distance
- Daily listening quota per user (5 minutes/day for free accounts)
- Monotonic playback tracking via heartbeat and completion events to prevent double-counting
- Admin endpoints for track update and deletion
- Full-text and genre-based track search

## How it works

1. The web app requests a presigned S3 URL from the upload service and uploads the file directly to S3.
2. The upload service enqueues a Celery task.
3. The processor worker downloads the file, extracts audio features, generates encrypted HLS variants with FFmpeg, uploads everything to S3, and writes all metadata to Postgres.
4. The web app polls job status until complete, then streams via HLS.js.
5. The HLS player fetches segments from S3 and requests the AES key from the API, which requires a valid bearer token.

![Architecture](mist_arch.png)

## Project structure

```
api-service/       FastAPI app — auth, tracks, listening, keys
upload-service/    FastAPI app — upload flow and job status
processor/         Celery worker — FFmpeg pipeline and feature extraction
shared/            Installable Python package — models, controllers, config, auth utils
web/               Next.js frontend
docker-compose.yml Orchestrates all services
```

## Installation

### Prerequisites

- Docker and Docker Compose
- AWS account with an S3 bucket and credentials
- PostgreSQL database (local, Railway, Supabase, or similar)

### 1. Clone the repo

```bash
git clone https://github.com/Arun-Kumar21/mist.git
cd mist
```

### 2. Configure environment

```bash
cp .env.example .env
cp web/env.example web/.env.local
```

Update `.env` for your local/dev values:

```env
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000

API_BASE_URL=http://localhost:8000
HLS_KEY_BASE_URL=http://localhost:8000

DATABASE_URL=postgresql://user:password@host:5432/mist_db
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your-bucket-name

CLIENT_URLS=http://localhost:3000
SECRET_KEY=a-long-random-string
LOG_LEVEL=DEBUG
```

Update `web/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_UPLOAD_API_BASE_URL=http://localhost:8001/api/v1
```

Notes:

- `web/env.example` uses production-style domain placeholders. For local development, use localhost values in `web/.env.local` as shown above.
- Docker Compose reads root `.env` automatically. The web image uses `NEXT_PUBLIC_*` values from root `.env` as build args.

### 3. Run with Docker Compose

```bash
docker compose up --build
```

This starts:

- Next.js web app at `http://localhost:3000`
- API at `http://localhost:8000`
- Upload service at `http://localhost:8001`
- Processor worker (no public port)
- Redis

Database tables are created automatically by SQLAlchemy when the API boots for the first time.

### Running without Docker

Install the shared package first, then each service separately.

Start Redis first (required by upload and processor services).

```bash
docker run --name mist-redis -p 6379:6379 redis:7-alpine
```

```bash
# Shared package (required by all Python services)
pip install -e shared/
```

**API service:**

```bash
cd api-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Upload service:**

```bash
cd upload-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

**Processor worker:**

```bash
cd processor
pip install -r requirements.txt
celery -A celery_app worker --loglevel=info --concurrency=2
```

**Frontend:**

```bash
cd web
cp env.example .env.local
npm install
npm run dev
```

## S3 bucket setup

The bucket needs a CORS policy allowing `GET` and `PUT` from your web app origin so the browser can upload files and the HLS player can fetch segments.

Example CORS configuration for the bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": []
  }
]
```

Apply it via the AWS console under the bucket's Permissions tab, or with the AWS CLI.


- Implement Redis caching for track metadata to improve performance
- Integrate a payment gateway for premium account upgrades
- Adjust daily listening quotas based on payment status
- Add automated tests for core services and endpoints