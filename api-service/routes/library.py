from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
import logging

from shared.db.controllers import (
    TrackRepository,
    TrackLikeRepository,
    PlaylistRepository,
    PlaylistTrackRepository,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/library", tags=["Library"])


def _require_user_uuid(request: Request) -> UUID:
    if not hasattr(request.state, 'user'):
        raise HTTPException(status_code=401, detail="Authentication required")
    return request.state.user.user_id


class CreatePlaylistRequest(BaseModel):
    name: str
    description: str | None = None
    is_public: bool = False


class UpdatePlaylistRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    is_public: bool | None = None


@router.post("/likes/{track_id}")
async def like_track(track_id: int, request: Request):
    try:
        user_id = _require_user_uuid(request)
        if not TrackRepository.get_by_id(track_id):
            raise HTTPException(status_code=404, detail="Track not found")
        created = TrackLikeRepository.like_track(user_id, track_id)
        return {"success": True, "liked": True, "created": created}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error liking track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/likes/{track_id}")
async def unlike_track(track_id: int, request: Request):
    try:
        user_id = _require_user_uuid(request)
        deleted = TrackLikeRepository.unlike_track(user_id, track_id)
        return {"success": True, "liked": False, "removed": deleted}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unliking track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/likes")
async def get_likes(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    try:
        user_id = _require_user_uuid(request)
        rows = TrackLikeRepository.get_liked_tracks(user_id, limit=limit, offset=offset)
        return {"success": True, "count": len(rows), "tracks": rows}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching liked tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/likes/{track_id}/status")
async def get_like_status(track_id: int, request: Request):
    try:
        user_id = _require_user_uuid(request)
        liked = TrackLikeRepository.is_liked(user_id, track_id)
        return {"success": True, "track_id": track_id, "liked": liked}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching like status for {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/playlists")
async def create_playlist(req: CreatePlaylistRequest, request: Request):
    try:
        user_id = _require_user_uuid(request)
        playlist = PlaylistRepository.create(
            user_id=user_id,
            name=req.name,
            description=req.description,
            is_public=req.is_public,
        )
        return {"success": True, "playlist": playlist.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating playlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/playlists")
async def get_my_playlists(request: Request):
    try:
        user_id = _require_user_uuid(request)
        playlists = PlaylistRepository.get_user_playlists(user_id)
        return {"success": True, "count": len(playlists), "playlists": [p.to_dict() for p in playlists]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching playlists: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/playlists/{playlist_id}")
async def get_playlist(playlist_id: UUID, request: Request):
    try:
        user_id = _require_user_uuid(request)
        playlist = PlaylistRepository.get_by_id(playlist_id)
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")
        if str(playlist.user_id) != str(user_id):
            raise HTTPException(status_code=403, detail="Forbidden")

        tracks = PlaylistTrackRepository.get_playlist_tracks(playlist_id)
        return {"success": True, "playlist": playlist.to_dict(), "tracks": tracks}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching playlist {playlist_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/playlists/{playlist_id}")
async def update_playlist(playlist_id: UUID, req: UpdatePlaylistRequest, request: Request):
    try:
        user_id = _require_user_uuid(request)
        update_data = req.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        updated = PlaylistRepository.update(playlist_id, user_id, update_data)
        if not updated:
            raise HTTPException(status_code=404, detail="Playlist not found")

        playlist = PlaylistRepository.get_by_id(playlist_id)
        return {"success": True, "playlist": playlist.to_dict() if playlist else None}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating playlist {playlist_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: UUID, request: Request):
    try:
        user_id = _require_user_uuid(request)
        deleted = PlaylistRepository.delete(playlist_id, user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Playlist not found")
        return {"success": True, "message": "Playlist deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting playlist {playlist_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/playlists/{playlist_id}/tracks/{track_id}")
async def add_track_to_playlist(playlist_id: UUID, track_id: int, request: Request):
    try:
        user_id = _require_user_uuid(request)
        if not TrackRepository.get_by_id(track_id):
            raise HTTPException(status_code=404, detail="Track not found")

        added = PlaylistTrackRepository.add_track(playlist_id, user_id, track_id)
        if not added:
            raise HTTPException(status_code=400, detail="Track already in playlist or playlist not found")
        return {"success": True, "added": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding track {track_id} to playlist {playlist_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(playlist_id: UUID, track_id: int, request: Request):
    try:
        user_id = _require_user_uuid(request)
        removed = PlaylistTrackRepository.remove_track(playlist_id, user_id, track_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Track not found in playlist or playlist not found")
        return {"success": True, "removed": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing track {track_id} from playlist {playlist_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
