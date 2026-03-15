from fastapi import APIRouter, HTTPException, Query, Request, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import os
import logging
import uuid

from shared.db.controllers import TrackRepository, TrackEmbeddingRepository
from shared.db.controllers.analytics_controller import AnalyticsRepository
from services.s3_service import (
    generate_hls_stream_url,
    delete_track_files,
    upload_track_cover_image,
    delete_track_cover_image,
)
from services.listening_service import ListeningService
from middleware import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tracks", tags=["Tracks"])

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')
API_PREFIX = 'api/v1'
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("")
async def get_tracks(
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    offset: int = Query(default=0, ge=0),
    genre: Optional[str] = Query(default=None)
):
    actual_offset = skip if skip > 0 else offset
    try:
        if genre:
            tracks = TrackRepository.filter_by_genre(genre, limit, actual_offset)
        else:
            tracks = TrackRepository.get_all(limit, actual_offset)
        return {"success": True, "count": len(tracks), "tracks": [t.to_dict() for t in tracks]}
    except Exception as e:
        logger.error(f"Error fetching tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_tracks(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=10, ge=1, le=100)
):
    try:
        tracks = TrackRepository.search(q, limit)
        return {"success": True, "query": q, "count": len(tracks), "tracks": [t.to_dict() for t in tracks]}
    except Exception as e:
        logger.error(f"Error searching tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/popular")
async def get_popular_tracks(limit: int = Query(default=10, ge=1, le=50)):
    try:
        popular = AnalyticsRepository.get_popular_tracks(limit)
        return {"success": True, "count": len(popular), "tracks": popular}
    except Exception as e:
        logger.error(f"Error fetching popular tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{track_id}")
async def get_track_by_id(track_id: int):
    try:
        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        return {"success": True, "track": track.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{track_id}/stream")
async def get_stream_info(track_id: int, request: Request):
    try:
        if not hasattr(request.state, 'user'):
            raise HTTPException(status_code=401, detail="Authentication required")

        user = request.state.user
        user_id = str(user.user_id)
        ip_address = request.client.host

        quota_info = ListeningService.check_quota_available(user_id, ip_address, user)
        if not quota_info["has_quota"]:
            raise HTTPException(status_code=429, detail={
                "error": "Daily listening quota exceeded",
                "quota_limit": quota_info["quota_limit"],
                "minutes_used": quota_info["minutes_used"]
            })

        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        if not track.cdn_url:
            raise HTTPException(status_code=404, detail="Stream not available")

        # Prefer persisted CDN URL from processing pipeline; fallback to reconstructed URL.
        stream_url = track.cdn_url or generate_hls_stream_url(track_id)
        return {
            "success": True,
            "trackId": track.track_id,
            "streamUrl": stream_url,
            "keyEndpoint": f"{API_BASE_URL}/{API_PREFIX}/keys/{track_id}",
            "duration": track.duration_sec,
            "encrypted": True
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stream info for track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{track_id}/similar")
async def get_similar_tracks(track_id: int, limit: int = Query(default=10, ge=1, le=50)):
    try:
        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        similar_tracks = TrackEmbeddingRepository.find_similar_tracks(track_id, limit)
        return {
            "success": True,
            "trackId": track_id,
            "similar": [
                {"trackId": t[0].track_id, "title": t[0].title, "artist": t[0].artist_name, "similarity": 1 - t[1]}
                for t in similar_tracks
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding similar tracks for {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateTrackRequest(BaseModel):
    title: Optional[str] = None
    artist_name: Optional[str] = None
    album_title: Optional[str] = None
    genre_top: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_featured_home: Optional[bool] = None
    home_feature_score: Optional[int] = None


@router.put("/{track_id}")
@require_admin
async def update_track(track_id: int, req: UpdateTrackRequest, request: Request):
    try:
        if not TrackRepository.get_by_id(track_id):
            raise HTTPException(status_code=404, detail="Track not found")
        update_data = req.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        TrackRepository.update(track_id, update_data)
        return {"success": True, "track": TrackRepository.get_by_id(track_id).to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{track_id}")
@require_admin
async def delete_track(track_id: int, request: Request):
    try:
        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        try:
            delete_track_files(track_id)
        except Exception as s3_error:
            logger.error(f"Error deleting S3 files: {s3_error}")
        if track.cover_image_key:
            try:
                delete_track_cover_image(track.cover_image_key)
            except Exception as s3_error:
                logger.error(f"Error deleting track cover image: {s3_error}")
        TrackRepository.delete(track_id)
        return {"success": True, "message": f"Track {track_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{track_id}/cover-image")
@require_admin
async def upload_track_cover(track_id: int, request: Request, image: UploadFile = File(...)):
    try:
        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")

        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported image type. Use JPEG, PNG, WebP, or AVIF.")

        file_bytes = await image.read()
        if len(file_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=413, detail="Image exceeds 10 MB limit.")

        ext = image.filename.rsplit('.', 1)[-1].lower() if image.filename and '.' in image.filename else 'jpg'
        image_key = f"tracks/covers/{track_id}/{uuid.uuid4()}.{ext}"
        image_url = upload_track_cover_image(file_bytes, image_key, image.content_type)

        old_key = track.cover_image_key
        TrackRepository.update(track_id, {
            "cover_image_url": image_url,
            "cover_image_key": image_key,
        })

        if old_key:
            try:
                delete_track_cover_image(old_key)
            except Exception as e:
                logger.warning(f"Could not delete old track cover image {old_key}: {e}")

        updated = TrackRepository.get_by_id(track_id)
        return {"success": True, "track": updated.to_dict() if updated else None}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading cover image for track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
