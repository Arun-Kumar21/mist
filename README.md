# MIST

A music streaming platform built with React, FastAPI, and HLS. Upload audio files, they get transcoded into AES-128 encrypted HLS streams and served from S3.

## Stack

- **Frontend** — React 19 + TypeScript, HLS.js, Zustand, Tailwind
- **Backend** — FastAPI, SQLAlchemy, PostgreSQL (pgvector)
- **Workers** — Celery + Redis for async audio processing
- **Storage** — AWS S3 for HLS segments and playlists

## How it works

When a track is uploaded, a Celery worker picks it up and runs it through FFmpeg — normalising the audio, generating multi-bitrate HLS variants (64/128/192kbps), encrypting each segment with AES-128, extracting audio features (MFCCs, spectral centroids, chroma), and pushing everything to S3. The encryption keys are stored in Postgres and only served to authenticated users.

![Architecture](mist%20arch.png)


## Installation

### Prerequisites

- Docker & Docker Compose
- AWS account with an S3 bucket
- PostgreSQL database (or use a hosted one like Railway/Supabase)

### 1. Clone the repo

```bash
git clone https://github.com/Arun-Kumar21/mist.git
cd mist
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mist_db
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
SECRET_KEY=some-random-string
JWT_SECRET_KEY=another-random-string
```

Create a `client/.env` for the frontend:

```env
VITE_SERVER_URL=http://localhost:8000/api/v1
```

### 3. Run with Docker Compose

```bash
docker compose up --build
```

This starts:
- API at `http://localhost:8000`
- React client at `http://localhost:3000`
- Celery worker + Flower at `http://localhost:5555`
- Redis

The API container runs `python start_server.py` which waits for the database, runs `init_db.py` to create all tables, then starts uvicorn — so no separate init step is needed.

### Running without Docker

**Backend:**

```bash
cd server
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Initialise the database (creates all tables):

```bash
python init_db.py
```

Start the API:

```bash
python start_server.py
```

Or use uvicorn directly (skips the startup checks):

```bash
uvicorn api.main:app --reload --port 8000
```

In a separate terminal, start the Celery worker:

```bash
celery -A celery_app worker --loglevel=info --concurrency=2
```

**Frontend:**

```bash
cd client
npm install
npm run dev
```

## S3 Setup

Your bucket needs a CORS policy that allows `GET` from your client origin and the HLS key endpoint. Run the setup script to apply it automatically:

```bash
cd server
python setup_s3.py
```

## TODO

- [ ] Redis caching for track metadata
- [ ] Content-based recommendations using audio embeddings
- [ ] Playlist management
- [ ] UI redesign