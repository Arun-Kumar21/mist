# MIST System Architecture

This document describes the current implementation in this repository after the microservice split.
It focuses on real behavior in code (endpoints, auth flow, Celery tasks, FFmpeg/HLS pipeline, DB schema usage, and deployment topology).

## 1) Runtime Topology

The stack is orchestrated by `docker-compose.yml`.

Services:

- `web` (Next.js app)
  - Host port: `3000`
  - Container port: `3000`
  - Depends on: `api`
- `api` (FastAPI)
  - Host port: `8000`
  - Container port: `8000`
  - Depends on: `redis`
- `upload` (FastAPI)
  - Host port: `8001`
  - Container port: `8000`
  - Depends on: `redis`
- `processor` (Celery worker)
  - No public port
  - Depends on: `redis`
- `redis` (queue + result backend)
  - Host/container port: `6379`

All services use shared bridge network `mist-network`.

## 2) Service Boundaries

### 2.1 API service (`api-service`)

Responsibilities:

- User auth (`register`, `login`, `me`)
- Track read/search/popular/similar
- Home content sections (`popular_songs`, `most_listened`, `top_pick`)
- Banner management and delivery
- Curated top-pick management (admin)
- User library features (likes + playlists)
- Stream bootstrap (`/tracks/{id}/stream`)
- Listening session + quota accounting
- HLS key delivery to authenticated users
- Admin endpoints (IP block maintenance, track update/delete)

### 2.2 Upload service (`upload-service`)

Responsibilities:

- Authenticated upload initiation (presigned POST URL)
- Mark upload complete
- Enqueue async processing via Celery task `tasks.process_audio`
- Job status retrieval

### 2.3 Processor service (`processor`)

Responsibilities:

- Consume `tasks.process_audio`
- Download original audio from S3
- Extract audio features (librosa)
- Build normalized embedding vector
- Create DB records (track, features, embedding, encryption key, job linkage)
- Transcode to encrypted multi-bitrate HLS (FFmpeg)
- Upload generated HLS assets to S3

### 2.4 Shared package (`shared`)

Responsibilities:

- Centralized settings/config
- SQLAlchemy engine/session/model definitions
- Repository layer for CRUD/query access
- Security helpers (password hash, JWT sign/verify)

## 3) Boot and Middleware Behavior

## 3.1 API app boot

`api-service/main.py`:

- Creates FastAPI app `MIST API`
- Global SlowAPI default limit: `100/minute`
- CORS via `settings.ALLOWED_ORIGINS`
- Adds `AuthMiddleware` (`enable_protection=True`)
- Registers route groups under `/api/v1`
- Registers key routes twice:
  - `/api/v1/keys/{track_id}`
  - `/api/keys/{track_id}` (compat alias)

## 3.2 Route access model

`api-service/middleware/config.py`:

Public routes:

- `/api/v1/health`
- `/api/v1/auth/register`
- `/api/v1/auth/login`
- `GET /api/v1/banners`
- `GET /api/v1/home/*`
- `GET /api/v1/tracks`
- `GET /api/v1/tracks/{id}`
- `GET /api/v1/tracks/search`
- `GET /api/v1/tracks/popular`
- `GET /api/v1/tracks/{id}/similar`

Admin route prefixes:

- `/api/v1/upload` (classified as admin in API middleware config)
- `/api/v1/banners/all`

`AuthMiddleware` behavior:

- Skips all `OPTIONS`
- Skips auth checks for public routes
- Expects `Authorization: Bearer <JWT>` on protected routes
- Decodes JWT with `SECRET_KEY` and `HS256`
- Loads user by username from DB
- Enforces admin role when path is admin route
- Injects `request.state.user`, `request.state.username`, `request.state.role`

## 4) API Endpoint Catalog

Base prefix: `/api/v1`

## 4.1 Health

- `GET /health`
  - Auth: public
  - Returns: `{"status": "ok"}`

## 4.2 Auth (`routes/auth.py`)

- `OPTIONS /auth/register`, `OPTIONS /auth/login`, `OPTIONS /auth/me`
- `POST /auth/register`
  - Auth: public
  - Rate limit: `10/minute`
  - Body: `username`, `password`
  - Validation: username >= 3 chars, password >= 8 chars, unique username
  - Side effects:
    - Creates user with bcrypt hash
    - Signs JWT `{username, role, exp=7 days}`
  - Returns: token + user fields (`user_id`, `username`, `role`)
- `POST /auth/login`
  - Auth: public
  - Rate limit: `10/minute`
  - Body: `username`, `password`
  - Side effects:
    - Verifies password hash
    - Updates `last_login_at`
    - Returns signed JWT
- `GET /auth/me`
  - Auth: required
  - Returns current user profile from middleware state

## 4.3 Tracks (`routes/tracks.py`)

- `GET /tracks`
  - Auth: public
  - Query: `limit`, `skip`, `offset`, optional `genre`
  - Behavior: uses `skip` over `offset` if provided
- `GET /tracks/search`
  - Auth: public
  - Query: `q`, `limit`
  - Search fields: title/artist ILIKE
- `GET /tracks/popular`
  - Auth: public
  - Uses listening history count aggregation
- `GET /tracks/{track_id}`
  - Auth: public
  - Returns track details
- `GET /tracks/{track_id}/stream`
  - Auth: required
  - Behavior:
    - Checks listening quota first
    - Requires track exists and has `cdn_url`
    - Returns stream bootstrap payload:
      - `streamUrl`: S3 `master.m3u8`
      - `keyEndpoint`: API key endpoint URL
      - `encrypted: true`
      - `duration`
- `GET /tracks/{track_id}/similar`
  - Auth: public
  - Uses pgvector cosine distance
  - Returns similarity as `1 - distance`
- `PUT /tracks/{track_id}`
  - Auth: admin only (`@require_admin`)
  - Partial update on whitelisted fields
  - Includes home featuring controls:
    - `is_featured_home`
    - `home_feature_score`
- `DELETE /tracks/{track_id}`
  - Auth: admin only
  - Side effects:
    - Attempts S3 cleanup under `audio/hls/{track_id}/`
    - Deletes track row

## 4.4 Listening (`routes/listen.py`)

- `POST /listen/start`
  - Auth: required
  - Body: `track_id`
  - Behavior:
    - Confirms track exists
    - Quota check
    - Creates listening session row
    - Increments `tracks_started`
    - Increments track-level counters (`listens`, `home_feature_score`)
  - Returns: `session_id` + quota snapshot
- `POST /listen/heartbeat`
  - Auth: required
  - Body: `session_id`, `current_time`
  - Behavior:
    - Monotonic duration update (no backward time double counting)
    - Increments day quota only by positive delta
- `POST /listen/complete`
  - Auth: required
  - Body: `session_id`, `total_duration`
  - Behavior:
    - Final monotonic total
    - Marks session completed
    - Increments `tracks_completed`
- `GET /listen/quota`
  - Auth: required
  - Returns current quota stats

## 4.5 HLS key delivery (`routes/keys.py`)

- `OPTIONS /keys/{track_id}`
  - Dynamic CORS origin negotiation via `settings.get_key_cors_origin(origin)`
- `GET /keys/{track_id}`
  - Auth: required
  - Loads 16-byte AES key from DB
  - Returns `application/octet-stream` body exactly 16 bytes
  - Response headers include CORS + `Cache-Control: no-store`

## 4.6 Banner (`routes/banner.py`)

- `GET /banners`
  - Auth: public
  - Returns active banners ordered by `display_order`
  - Image URL is returned as signed S3 URL (temporary)
- `GET /banners/all`
  - Auth: admin only
  - Returns active + inactive banners
- `POST /banners`
  - Auth: admin only
  - Multipart image upload + metadata
  - Persists `image_key` and returns signed image URL
- `PUT /banners/{banner_id}`
  - Auth: admin only
  - Updates metadata (`title`, `subtitle`, `link_url`, `display_order`, `is_active`)
- `PUT /banners/{banner_id}/image`
  - Auth: admin only
  - Replaces image and attempts old image cleanup
- `DELETE /banners/{banner_id}`
  - Auth: admin only
  - Deletes DB row and attempts S3 image cleanup

## 4.7 Home sections (`routes/home.py`)

- `GET /home/sections`
  - Auth: public
  - Returns:
    - `popular_songs` (featured-home tracks)
    - `most_listened` (tracks by `listens` desc)
    - `top_pick` (admin curated picks)
- `GET /home/popular`
  - Auth: public
  - Featured home tracks only
- `GET /home/most-listened`
  - Auth: public
  - Tracks sorted by listens count
- `GET /home/top-pick`
  - Auth: public
  - Admin curated list with curation metadata + track data

## 4.8 Curation (`routes/curation.py`)

- `GET /curation/top-picks`
  - Auth: public
  - Query: `active_only`
  - Returns curated track list
- `POST /curation/top-picks`
  - Auth: admin only (`@require_admin`)
  - Upserts a curated entry for a track
- `PUT /curation/top-picks/{track_id}`
  - Auth: admin only
  - Updates curation `display_order` / `is_active`
- `DELETE /curation/top-picks/{track_id}`
  - Auth: admin only
  - Removes track from curated table

## 4.9 Library (`routes/library.py`)

Likes:

- `POST /library/likes/{track_id}`
  - Auth: required
  - Creates like if not already present
- `DELETE /library/likes/{track_id}`
  - Auth: required
  - Removes like entry
- `GET /library/likes`
  - Auth: required
  - Returns current user's liked tracks
- `GET /library/likes/{track_id}/status`
  - Auth: required
  - Returns whether user likes given track

Playlists:

- `POST /library/playlists`
  - Auth: required
  - Creates a user playlist
- `GET /library/playlists`
  - Auth: required
  - Lists current user's playlists
- `GET /library/playlists/{playlist_id}`
  - Auth: required
  - Returns playlist metadata + tracks
- `PUT /library/playlists/{playlist_id}`
  - Auth: required (owner only)
  - Updates playlist metadata
- `DELETE /library/playlists/{playlist_id}`
  - Auth: required (owner only)
  - Deletes playlist
- `POST /library/playlists/{playlist_id}/tracks/{track_id}`
  - Auth: required (owner only)
  - Adds a track to playlist
- `DELETE /library/playlists/{playlist_id}/tracks/{track_id}`
  - Auth: required (owner only)
  - Removes a track from playlist

## 5) Upload Service Endpoint Catalog

Base prefix: `/api/v1`

`upload-service/main.py`:

- FastAPI app with SlowAPI default `30/minute`
- CORS origins from `CLIENT_URLS`
- Health endpoint

Endpoints (`upload-service/routes/upload.py`):

- `POST /upload/request`
  - Auth: required (manual bearer verification in route)
  - Rate limit: `5/minute`
  - Body:
    - `filename`
    - `filesize`
    - `contentType`
    - `metadata` (optional dict)
  - Behavior:
    - Creates processing job (`pending_upload`)
    - Generates S3 presigned POST for key `audio/original/{job_id}/{filename}`
    - Stores `s3_input_key` and marks job `uploaded`
  - Returns: `jobId`, `uploadUrl`, `fields`, `s3Key`, `expiresIn`

- `POST /upload/complete`
  - Auth: required
  - Rate limit: `5/minute`
  - Body: `jobId`, `metadata`
  - Behavior:
    - Validates job + S3 key
    - Updates job status to `uploaded`
    - Enqueues Celery task `tasks.process_audio(jobId, metadata)`
  - Returns: `taskId`, `jobId`, status

- `GET /upload/job/{job_id}`
  - Auth: required
  - Returns job status/timestamps
  - Includes track info when completed and linked
  - Includes error message when failed

## 6) Celery and Async Processing

## 6.1 Broker/backend

- Redis URL from `REDIS_URL`
- Both upload and processor define Celery apps
- Processor worker consumes named task `tasks.process_audio`

## 6.2 Processor Celery config (`processor/celery_app.py`)

Important settings:

- `task_track_started=True`
- `task_time_limit=3600`
- `worker_prefetch_multiplier=1` (better fairness for long tasks)
- `worker_max_tasks_per_child=50` (mitigates leaks)
- `broker_connection_retry_on_startup=True`

## 6.3 Task flow (`processor/tasks/audio_processing.py`)

`process_audio_task(job_id, metadata)`:

1. Mark job `processing`
2. Load job row and `s3_input_key`
3. Call `process_audio_file(...)`
4. On success return track result
5. On failure:
   - Mark job `failed`
   - Retry with Celery retry (`countdown=60`, `max_retries=3`)

Auxiliary task:

- `tasks.cleanup_temp_files(job_id)` removes `/tmp/{job_id}`

## 7) FFmpeg/HLS Pipeline Details

Implemented in `processor/services/audio_processing_service.py` + `processor/processing/hls_converter.py`.

## 7.1 End-to-end pipeline per job

1. Create temp workspace: `/tmp/{job_id}`
2. Download source object from S3 key `audio/original/...`
3. Extract audio features (librosa)
4. Build 40-dimensional normalized embedding vector
5. Create `tracks` DB row with `processing_status='processing'`
6. Create random 16-byte AES key in `track_encryption_keys`
7. Convert source audio to encrypted HLS variants
8. Upload generated HLS tree to S3 prefix `audio/hls/{track_id}`
9. Compute CDN URL:
   - `https://{bucket}.s3.{region}.amazonaws.com/audio/hls/{track_id}/master.m3u8`
10. Update track (`cdn_url`, `duration_sec`, `processing_status='completed'`)
11. Persist extracted features and embedding
12. Link job to track and mark job `completed`
13. Cleanup temp directory

On exception:

- Job marked `failed`
- Track (if already created) marked `processing_status='failed'`
- Temp cleanup still attempted in `finally`

## 7.2 HLS generation specifics

`convert_to_hls(...)` settings:

- Variants: `64k`, `128k`, `192k`
- Audio codec: `aac`
- Segment length: `10s` (`hls_time=10`)
- Playlist type: `vod`
- Independent segments enabled
- Segment pattern: `segment_%03d.ts`

Master playlist generated manually with entries:

- `#EXT-X-STREAM-INF:BANDWIDTH=<bitrate*1000>,CODECS="mp4a.40.2"`

## 7.3 HLS encryption model

- One AES-128 key per track (16 bytes)
- Temporary local files generated during conversion:
  - `enc.key`
  - `enc.keyinfo`
- `key_uri` embedded in playlist points to API endpoint:
  - `{API_BASE_URL}/api/v1/keys/{track_id}`
- Temporary key files are deleted after conversion

## 8) Audio Feature and Embedding Strategy

## 8.1 Feature extraction (`processor/processing/audio_features.py`)

Feature set includes:

- Spectral: centroid, rolloff, bandwidth, contrast, flatness
- MFCC means + std for 20 coefficients
- Chroma stats
- Tempo and beat strength
- ZCR and RMS stats
- Mel spectrogram stats
- Harmonic/percussive separation stats
- Duration

Librosa load parameters:

- sample rate: `22050`
- max analyzed duration: `30` seconds

## 8.2 Embedding (`processor/processing/embedding_utils.py`)

- Selects 40 scalar features (20 core + 20 MFCC means)
- Converts to float vector
- L2-normalizes vector
- Stored in pgvector column (`Vector(40)`) with IVFFLAT cosine index

Similarity endpoint computes cosine distance in DB and returns score as `1 - distance`.

## 9) Data Model Summary

Main entities (`shared/db/models`):

- `users`
  - UUID PK, username, password_hash, role enum (`admin`|`user`), last login timestamps
- `tracks`
  - Metadata, processing status, CDN URL, duration, counters
  - Home fields: `is_featured_home`, `home_feature_score`
- `processing_jobs`
  - UUID `job_id`, status lifecycle, optional linked `track_id`, error fields
- `audio_features`
  - One-to-one per track (`track_id` unique)
- `track_embeddings`
  - pgvector(40), cosine index
- `track_encryption_keys`
  - 16-byte binary key per track
- `user_listening_history`
  - Per session playback progress and completion
- `daily_listen_quota`
  - Daily minute usage + started/completed counters
- `banners`
  - Hero banner metadata, activation state, order, S3 image key
- `admin_curated_tracks`
  - Admin-managed curated ordering for home top picks
- `track_likes`
  - User-track like relation (unique per user+track)
- `playlists`
  - User-owned playlist metadata
- `playlist_tracks`
  - Playlist-to-track entries with position

## 10) Quota and Listening Accounting

Current quota implementation (`api-service/services/listening_service.py`):

- Free users: `5` minutes/day
- Premium path currently returns same free limit (no differentiated branch active)
- Quota tracked by user ID when present, else IP fallback

Stability logic:

- Heartbeat and completion use monotonic duration (`max(new, previous)`)
- Quota increments only by positive delta to prevent backward seek resets from reducing time
- Daily records are date-range matched (UTC day start/end)
- Listen start increments track ranking counters used by home sections:
  - `tracks.listens`
  - `tracks.home_feature_score`

## 11) Security Model

## 11.1 Authentication and authorization

- JWT signed with `SECRET_KEY` (`HS256`), expiry 7 days
- Protected API routes rely on middleware token verification
- Upload service independently verifies bearer JWT in route handlers
- Role checks:
  - Middleware enforces admin for admin-route paths
  - Additional decorator enforcement (`@require_admin`) on sensitive handlers

## 11.2 Passwords

- Stored as bcrypt hash
- Verification via bcrypt check

## 11.3 HLS key protection

- Encryption keys are not stored in S3 public paths
- Keys served only from API endpoint requiring authenticated user
- Key responses sent with `Cache-Control: no-store`

## 11.4 CORS behavior

- API and upload services apply CORS middleware
- Key endpoint applies dynamic origin handling per request
- In development key endpoint may return wildcard origin (`*`)

## 12) S3 Object Layout

Upload input:

- `audio/original/{job_id}/{filename}`

Processed output:

- `audio/hls/{track_id}/master.m3u8`
- `audio/hls/{track_id}/{bitrate}/playlist.m3u8`
- `audio/hls/{track_id}/{bitrate}/segment_XXX.ts`

Delete path (track deletion):

- Prefix delete on `audio/hls/{track_id}/`

## 13) Configuration Surface

Primary env vars in use:

- Database: `DATABASE_URL`
- Auth: `SECRET_KEY` (JWT helper uses `SECRET_KEY`)
- AWS: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`
- Queue: `REDIS_URL`
- Client/API origins: `CLIENT_URLS`
- API URL composition: `API_BASE_URL`
- Runtime: `PORT`, `ENVIRONMENT`, `LOG_LEVEL`

## 14) Deployment and Build Notes

Docker build strategy:

- Each Python service copies and installs `shared` package (`pip install -e /app/shared`)
- `PYTHONPATH=/app` set in service images
- Processor image includes system packages:
  - `ffmpeg`
  - `libsndfile1`
  - `libpq-dev`

Web app serving:

- Next.js production server listens on container port `3000`
- Compose maps host `3000 -> 3000`

## 15) Operational Failure Modes and What Happens

- Invalid/missing JWT on protected routes -> `401`
- Non-admin on admin routes -> `403`
- Daily quota exhausted -> `429`
- Missing track/key/job -> `404`
- Processing exception -> job `failed`, Celery retry up to 3
- S3 cleanup failure on delete -> logged, track deletion still proceeds

## 16) Current Gaps and Non-obvious Behaviors

- `ListeningService.get_user_quota_limit` currently returns free tier for all roles.
- Upload route accepts `filesize` but does not enforce against presigned POST limit in code path (S3 presigned policy enforces up to 50 MB).
- API route config marks `/api/v1/upload` as admin path, but upload operations are handled by separate upload service with its own auth checks.
- Use a single `SECRET_KEY` value across all services handling JWT generation and verification.

## 17) Request/Processing Sequence (Concrete)

1. Client authenticates via `POST /api/v1/auth/login` (api service).
2. Client requests upload form via `POST /api/v1/upload/request` (upload service).
3. Client uploads binary directly to S3 using returned form fields.
4. Client confirms upload via `POST /api/v1/upload/complete` (upload service).
5. Upload service enqueues Celery task `tasks.process_audio`.
6. Processor downloads source audio from S3 and processes pipeline.
7. Processor writes DB entities and uploads encrypted HLS assets to S3.
8. Client fetches stream metadata via `GET /api/v1/tracks/{id}/stream` (api service).
9. HLS player loads playlist/segments from S3 and requests AES key from `/api/v1/keys/{id}` with bearer token.
10. Listening events (`start`, `heartbeat`, `complete`) update quota/session state in API DB.

---

This document reflects the current repository implementation and endpoint behavior in the microservice layout.
