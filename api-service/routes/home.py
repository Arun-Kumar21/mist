from fastapi import APIRouter, HTTPException, Query
import logging
from urllib.parse import urlparse, unquote

from shared.db.controllers.analytics_controller import AnalyticsRepository
from shared.db.controllers.playlist_controller import PlaylistRepository
from services.s3_service import generate_hls_stream_url, generate_object_public_url, generate_presigned_read_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/home", tags=["Home"])


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
    track_id = normalized.get("track_id")

    if cover_key:
        try:
            normalized["cover_image_url"] = generate_presigned_read_url(cover_key, expires_in=86400)
        except Exception:
            normalized["cover_image_url"] = generate_object_public_url(cover_key)
    if isinstance(track_id, int):
        normalized["cdn_url"] = generate_hls_stream_url(track_id)

    return normalized


def _normalize_top_pick(entries: list[dict]) -> list[dict]:
    normalized_entries = []
    for entry in entries:
        if isinstance(entry, dict) and isinstance(entry.get("track"), dict):
            normalized_entries.append({**entry, "track": _normalize_track(entry["track"])})
        else:
            normalized_entries.append(entry)
    return normalized_entries


def _normalize_popular_playlists(entries: list[dict]) -> list[dict]:
    normalized = []
    for entry in entries:
        if not isinstance(entry, dict):
            normalized.append(entry)
            continue

        row = dict(entry)
        cover_key = row.get("cover_image_key")
        if cover_key:
            try:
                row["cover_image_url"] = generate_presigned_read_url(cover_key, expires_in=86400)
            except Exception:
                row["cover_image_url"] = generate_object_public_url(cover_key)
        normalized.append(row)
    return normalized


@router.get("/sections")
async def get_home_sections(limit: int = Query(default=10, ge=1, le=50)):
    try:
        popular_songs = [_normalize_track(track) for track in AnalyticsRepository.get_featured_home_tracks(limit)]
        most_listened = [_normalize_track(track) for track in AnalyticsRepository.get_most_listened_tracks(limit)]
        top_pick = _normalize_top_pick(AnalyticsRepository.get_admin_top_picks(limit))
        popular_playlists = _normalize_popular_playlists(PlaylistRepository.get_public_popular_playlists(limit))

        return {
            "success": True,
            "sections": {
                "popular_songs": popular_songs,
                "most_listened": most_listened,
                "top_pick": top_pick,
                "popular_playlists": popular_playlists,
            },
        }
    except Exception as e:
        logger.error(f"Error fetching home sections: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/popular")
async def get_home_popular(limit: int = Query(default=10, ge=1, le=50)):
    try:
        tracks = [_normalize_track(track) for track in AnalyticsRepository.get_featured_home_tracks(limit)]
        return {"success": True, "count": len(tracks), "tracks": tracks}
    except Exception as e:
        logger.error(f"Error fetching home popular tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/most-listened")
async def get_home_most_listened(limit: int = Query(default=10, ge=1, le=50)):
    try:
        tracks = [_normalize_track(track) for track in AnalyticsRepository.get_most_listened_tracks(limit)]
        return {"success": True, "count": len(tracks), "tracks": tracks}
    except Exception as e:
        logger.error(f"Error fetching home most listened tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/top-pick")
async def get_home_top_pick(limit: int = Query(default=10, ge=1, le=50)):
    try:
        picks = _normalize_top_pick(AnalyticsRepository.get_admin_top_picks(limit))
        return {"success": True, "count": len(picks), "tracks": picks}
    except Exception as e:
        logger.error(f"Error fetching home top picks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/popular-playlists")
async def get_home_popular_playlists(limit: int = Query(default=10, ge=1, le=50)):
    try:
        playlists = _normalize_popular_playlists(PlaylistRepository.get_public_popular_playlists(limit))
        return {"success": True, "count": len(playlists), "playlists": playlists}
    except Exception as e:
        logger.error(f"Error fetching home popular playlists: {e}")
        raise HTTPException(status_code=500, detail=str(e))
