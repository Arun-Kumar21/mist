from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.controllers import TrackRepository, TrackEmbeddingRepository
from services.s3_service import delete_track_files
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tracks", tags=["Tracks"])

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')


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
        
        return {
            "success": True,
            "trackId": track.track_id,
            "streamUrl": track.cdn_url,
            "keyEndpoint": f"{API_BASE_URL}/api/keys/{track_id}",
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
        
        similar_tracks = TrackEmbeddingRepository.find_similar(track_id, limit)
        
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
async def update_track(track_id: int, req: UpdateTrackRequest):
    try:
        track = TrackRepository.get_by_id(track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        
        update_data = req.dict(exclude_unset=True)
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
async def delete_track(track_id: int):
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

