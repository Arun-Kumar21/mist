from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional
import os
import logging

from shared.db.controllers import TrackRepository, TrackEmbeddingRepository
from shared.db.controllers.analytics_controller import AnalyticsRepository
from services.s3_service import generate_hls_stream_url, delete_track_files
from services.listening_service import ListeningService
from middleware import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tracks", tags=["Tracks"])

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')
API_PREFIX = 'api/v1'


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

        stream_url = generate_hls_stream_url(track_id)
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
        if not TrackRepository.get_by_id(track_id):
            raise HTTPException(status_code=404, detail="Track not found")
        try:
            delete_track_files(track_id)
        except Exception as s3_error:
            logger.error(f"Error deleting S3 files: {s3_error}")
        TrackRepository.delete(track_id)
        return {"success": True, "message": f"Track {track_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
