from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
import logging
from urllib.parse import urlparse, unquote

from shared.db.controllers import (
    AnalyticsRepository,
    ListeningHistoryRepository,
    TrackRepository,
    TrackEmbeddingRepository,
    TrackLikeRepository,
    PlaylistRepository,
    PlaylistTrackRepository,
)
from services.s3_service import generate_hls_stream_url, generate_object_public_url, generate_presigned_read_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/library", tags=["Library"])


def _normalize_track(track: dict) -> dict:
    if not isinstance(track, dict):
        return track

    normalized = dict(track)
    cover_key = normalized.get("cover_image_key")
    if not cover_key:
        raw_cover_url = normalized.get("cover_image_url")
        if isinstance(raw_cover_url, str) and "amazonaws.com/" in raw_cover_url:
            parsed = urlparse(raw_cover_url)
            if parsed.path:
                cover_key = unquote(parsed.path.lstrip("/"))

    if cover_key:
        try:
            normalized["cover_image_url"] = generate_presigned_read_url(cover_key, expires_in=86400)
        except Exception:
            normalized["cover_image_url"] = generate_object_public_url(cover_key)

    track_id = normalized.get("track_id")
    if isinstance(track_id, int):
        normalized["cdn_url"] = generate_hls_stream_url(track_id)

    return normalized


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


@router.get("/feed")
async def get_personalized_feed(
    request: Request,
    limit: int = Query(default=24, ge=1, le=100),
):
    try:
        user_id = _require_user_uuid(request)
        liked_rows = TrackLikeRepository.get_liked_tracks(user_id, limit=12, offset=0)
        listened_rows = ListeningHistoryRepository.get_user_top_tracks(user_id, limit=8)

        seed_meta: dict[int, dict] = {}
        liked_seed_tracks: list[dict] = []
        listened_seed_tracks: list[dict] = []

        def register_seed(track: dict, weight: float, source: str):
            track_id = track.get("track_id")
            if not isinstance(track_id, int):
                return

            existing = seed_meta.get(track_id)
            if not existing:
                seed_meta[track_id] = {
                    "track": track,
                    "weight": 0.0,
                    "sources": set(),
                }
                existing = seed_meta[track_id]

            existing["weight"] += weight
            existing["sources"].add(source)

        for index, row in enumerate(liked_rows):
            track = row.get("track") or {}
            if not isinstance(track.get("track_id"), int):
                continue
            normalized_track = _normalize_track(track)
            liked_seed_tracks.append(normalized_track)
            register_seed(normalized_track, weight=2.4 - min(index, 10) * 0.08, source="liked")

        for row in listened_rows:
            track = row.get("track") or {}
            if not isinstance(track.get("track_id"), int):
                continue

            normalized_track = _normalize_track(track)

            play_count = int(row.get("play_count") or 0)
            total_duration = float(row.get("total_duration") or 0.0)
            listened_seed_tracks.append({
                **normalized_track,
                "play_count": play_count,
                "total_duration": total_duration,
            })
            register_seed(
                normalized_track,
                weight=1.0 + min(play_count, 8) * 0.35 + min(total_duration / 300.0, 1.5),
                source="listened",
            )

        candidate_map: dict[int, dict] = {}
        seed_track_ids = set(seed_meta.keys())

        for seed_track_id, meta in seed_meta.items():
            similar_tracks = TrackEmbeddingRepository.find_similar_tracks(seed_track_id, limit=min(max(limit // 2, 6), 12))

            for similar_track, distance in similar_tracks:
                if similar_track.track_id in seed_track_ids:
                    continue

                similarity = max(0.0, 1.0 - float(distance))
                if similarity <= 0.05:
                    continue

                popularity_bonus = min(float(similar_track.listens or 0) / 1000.0, 5.0)
                score = meta["weight"] * (similarity * 100.0) + popularity_bonus

                bucket = candidate_map.setdefault(
                    similar_track.track_id,
                    {
                        "track": _normalize_track(similar_track.to_dict()),
                        "score": 0.0,
                        "seed_track_ids": set(),
                        "reasons": set(),
                    },
                )
                bucket["score"] += score
                bucket["seed_track_ids"].add(seed_track_id)

                if "liked" in meta["sources"]:
                    bucket["reasons"].add("based on songs you liked")
                if "listened" in meta["sources"]:
                    bucket["reasons"].add("based on your listening history")

        ranked_candidates = sorted(
            candidate_map.values(),
            key=lambda item: item["score"],
            reverse=True,
        )

        recommendations: list[dict] = []
        seen_ids: set[int] = set(seed_track_ids)

        for item in ranked_candidates:
            track = item["track"]
            track_id = track.get("track_id")
            if not isinstance(track_id, int) or track_id in seen_ids:
                continue

            recommendations.append({
                **track,
                "recommendation_score": round(float(item["score"]), 2),
                "based_on_track_ids": sorted(item["seed_track_ids"]),
                "reasons": sorted(item["reasons"]),
            })
            seen_ids.add(track_id)

            if len(recommendations) >= limit:
                break

        if len(recommendations) < limit:
            fallback_tracks = AnalyticsRepository.get_most_listened_tracks(limit=limit * 2)
            for track in fallback_tracks:
                normalized_track = _normalize_track(track)
                track_id = normalized_track.get("track_id")
                if not isinstance(track_id, int) or track_id in seen_ids:
                    continue

                recommendations.append({
                    **normalized_track,
                    "recommendation_score": 0.0,
                    "based_on_track_ids": [],
                    "reasons": ["popular with listeners"],
                })
                seen_ids.add(track_id)

                if len(recommendations) >= limit:
                    break

        return {
            "success": True,
            "liked_seed_tracks": liked_seed_tracks,
            "listened_seed_tracks": listened_seed_tracks,
            "recommendations": recommendations,
            "count": len(recommendations),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error building personalized feed: {e}")
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
        playlist = PlaylistRepository.get_by_id(playlist_id)
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")

        user = getattr(request.state, 'user', None)
        user_id = getattr(user, 'user_id', None)
        is_owner = bool(user_id and str(playlist.user_id) == str(user_id))

        if not is_owner and not playlist.is_public:
            raise HTTPException(status_code=403, detail="Forbidden")

        tracks = PlaylistTrackRepository.get_playlist_tracks(playlist_id)
        return {
            "success": True,
            "playlist": playlist.to_dict(),
            "tracks": tracks,
            "is_owner": is_owner,
        }
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
