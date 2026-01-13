# MIST: Music Streaming Platform

MIST (Music Streaming) is a scalable, full-stack web application implementing modern music streaming capabilities with security and personalization features.

## Architecture

The system employs a microservices architecture consisting of:

- **Client**: React-based single-page application with TypeScript, utilizing Vite for build optimization
- **Server**: Python FastAPI backend with asynchronous request handling
- **Task Queue**: Celery for distributed audio processing workflows
- **Storage**: S3-compatible object storage for audio assets
- **Database**: PostgreSQL for relational data persistence

## Technical Implementation

### Adaptive Streaming
Audio files are transcoded to HLS format using FFmpeg, generating multiple quality variants (128kbps, 256kbps, 320kbps) with .m3u8 playlists and .ts segments. The client-side HLS.js library handles adaptive bitrate selection based on bandwidth estimation.

### Content Protection
Audio tracks undergo AES-128 encryption during HLS conversion. Encryption keys are stored in PostgreSQL with track-specific associations. The server implements JWT-based authentication for key retrieval endpoints, with Redis-backed rate limiting (100 requests per minute per IP) to prevent key extraction attacks.

### Audio Processing Pipeline
Celery workers handle asynchronous processing tasks:
1. Audio normalization and format conversion via FFmpeg
2. HLS segmentation with encryption
3. Audio feature extraction using Librosa (MFCCs, spectral features, tempo)
4. Metadata extraction and database persistence
5. S3 upload of processed segments

### Security Measures
- JWT access tokens with 15-minute expiration
- Refresh token rotation with Redis blacklist
- IP-based rate limiting middleware
- Admin-only upload endpoints with role verification
- SQL injection prevention via SQLAlchemy ORM

### Analytics
PostgreSQL stores listening history with timestamp precision. Track play counts and user interaction patterns are recorded for future recommendation system implementation.

## Technology Stack

**Frontend**: React, TypeScript, Zustand, Vite  
**Backend**: FastAPI, SQLAlchemy, Celery, Redis  
**Processing**: Librosa, FFmpeg, NumPy  
**Infrastructure**: Docker, Docker Compose

## Implementation Status

### Completed Features
- User authentication and authorization (JWT-based)
- Admin upload interface with drag-and-drop
- HLS adaptive streaming with multiple bitrates
- AES-128 encryption for audio content
- Asynchronous audio processing pipeline
- Audio feature extraction (MFCCs, spectral analysis)
- Listening history tracking
- Rate limiting middleware
- S3 integration for media storage
- Docker containerization

### Planned Features
- Content-based recommendation system using track embeddings
- Redis caching layer for top tracks and recommendations
- User playlist management
- Social features (following, sharing)
- Advanced analytics dashboard
- Collaborative filtering recommendations
- Mobile application
