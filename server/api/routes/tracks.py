from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.controllers import TrackRepository, TrackEmbeddingRepository
from db.controllers.analytics_controller import AnalyticsRepository
from services.s3_service import delete_track_files
from api.middleware import require_admin
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tracks", tags=["Tracks"])

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')
API_PREFIX = 'api/v1'


@router.get("/")
async def get_tracks(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    genre: Optional[str] = Query(default=None)
):
    try:
        if genre:
            tracks = TrackRepository.filter_by_genre(genre, limit, offset)
        else:
            tracks = TrackRepository.get_all(limit, offset)
        
        return {
            "success": True,
            "count": len(tracks),
            "tracks": [track.to_dict() for track in tracks]
        }
    except Exception as e:
        logger.error(f"Error fetching tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_tracks(
    q: str = Query(..., min_length=1, description="Search query for track title or artist name"),
    limit: int = Query(default=20, ge=1, le=100)
):
    """Search tracks by title or artist name"""
    try:
        tracks = TrackRepository.search(q, limit)
        return {
            "success": True,
            "query": q,
            "count": len(tracks),
            "tracks": [track.to_dict() for track in tracks]
        }
    except Exception as e:
        logger.error(f"Error searching tracks with query '{q}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/popular")
async def get_popular_tracks(limit: int = Query(default=10, ge=1, le=50)):
    """Get most popular tracks"""
    try:
        popular = AnalyticsRepository.get_popular_tracks(limit)
        return {
            "success": True,
            "count": len(popular),
            "tracks": popular
        }
    except Exception as e:
        logger.error(f"Error fetching popular tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{track_id}")
async def get_track_by_id(track_id: int):
    try:
        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        
        return {
            "success": True,
            "track": track.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{track_id}/stream")
async def get_stream_info(track_id: int):
    try:
        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        
        if not track.cdn_url:
            raise HTTPException(status_code=404, detail="Stream not available")
        
        # Use proxy URL for development to avoid CORS issues
        # In production, you would use the CDN URL directly if CORS is configured
        proxy_url = f"{API_BASE_URL}/{API_PREFIX}/proxy/{track_id}/master.m3u8"
        
        return {
            "success": True,
            "trackId": track.track_id,
            "streamUrl": proxy_url,  # Use proxy instead of CDN
            "cdnUrl": track.cdn_url,  # Original CDN URL for reference
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
async def get_similar_tracks(
    track_id: int,
    limit: int = Query(default=10, ge=1, le=50)
):
    try:
        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        
        similar_tracks = TrackEmbeddingRepository.find_similar_tracks(track_id, limit)
        
        return {
            "success": True,
            "trackId": track_id,
            "similar": [
                {
                    "trackId": t.track_id,
                    "title": t.track.title,
                    "artist": t.track.artist_name,
                    "similarity": float(t.similarity) if hasattr(t, 'similarity') else None
                }
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


@router.put("/{track_id}")
@require_admin
async def update_track(track_id: int, req: UpdateTrackRequest, request: Request):
    try:
        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        
        update_data = req.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        success = TrackRepository.update(track_id, update_data)
        if not success:
            raise HTTPException(status_code=500, detail="Update failed")
        
        updated_track = TrackRepository.get_by_id(track_id)
        return {
            "success": True,
            "track": updated_track.to_dict()
        }
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
            logger.info(f"Deleted S3 files for track {track_id}")
        except Exception as s3_error:
            logger.error(f"Error deleting S3 files: {s3_error}")
        
        success = TrackRepository.delete(track_id)
        if not success:
            raise HTTPException(status_code=500, detail="Delete failed")
        
        return {
            "success": True,
            "message": f"Track {track_id} deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

