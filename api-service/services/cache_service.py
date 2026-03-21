import json
import logging
from typing import Optional, Any

from main import redis_client

logger = logging.getLogger(__name__)

TTL_LIST = 300
TTL_GENRE = 60


def _serialize(data: Any) -> str:
    return json.dumps(data, default=str)


def _deserialize(data: Optional[str]) -> Any:
    if data is None:
        return None
    return json.loads(data)


def get_track_list_cache_key(limit: int, offset: int, genre: Optional[str] = None) -> str:
    if genre:
        return f"tracks:list:genre={genre}:limit={limit}:offset={offset}"
    return f"tracks:list:limit={limit}:offset={offset}"


def get_cached_track_list(limit: int, offset: int, genre: Optional[str] = None) -> Optional[list]:
    key = get_track_list_cache_key(limit, offset, genre)
    try:
        data = redis_client.get(key)
        if data:
            logger.debug(f"Cache hit: {key}")
            return _deserialize(data)
        logger.debug(f"Cache miss: {key}")
        return None
    except Exception as e:
        logger.warning(f"Cache get failed for {key}: {e}")
        return None

def get_track_cache_key(track_id):
    return f"track:detail:{track_id}"
    
def get_cache_track(track_id):
    key = get_track_cache_key(track_id)
    try:
        data = redis_client.get(key)
        if data:
            logger.debug(f"Cache hit: {key}")
            return _deserialize(data)
        logger.debug(f"Cache miss: {key}")
        return None
    except Exception as e:
        logger.warning(f"Cachce get failed for {key}: {e}")
        return None

def set_cached_track_list(
    tracks: list,
    limit: int,
    offset: int,
    genre: Optional[str] = None,
    ttl: int = None
) -> bool:
    key = get_track_list_cache_key(limit, offset, genre)
    if ttl is None:
        ttl = TTL_GENRE if genre else TTL_LIST
    try:
        redis_client.setex(key, ttl, _serialize(tracks))
        logger.debug(f"Cache set: {key} (TTL: {ttl}s)")
        return True
    except Exception as e:
        logger.warning(f"Cache set failed for {key}: {e}")
        return False

def set_cached_track(track, ttl) -> bool:
    key = get_cached_track_list(track.track_id)
    if ttl is None:
        ttl = TTL_LIST
    try:
        redis_client.setex(key, ttl, _serialize(track))
        logger.debug(f"Cache set: {key} (TTL: {ttl}s")
        return True
    except Exception as e:
        logger.warning(f"Cache set failed for {key}: {e}")
        return False

def invalidate_track_list_cache() -> int:
    try:
        keys = redis_client.keys("tracks:list:*")
        if keys:
            deleted = redis_client.delete(*keys)
            logger.debug(f"Invalidated {deleted} track list cache keys")
            return deleted
        return 0
    except Exception as e:
        logger.warning(f"Cache invalidation failed: {e}")
        return 0


def invalidate_track_cache() -> int:
    try:
        keys = redis_client.keys("track:detail:*")
        if keys:
            deleted = redis_client.delete(*keys)
            logger.debug(f"Invalidated {deleted} track cache keys")
            return deleted
        return 0

    except Exception as e:
        logger.warning(f"Cache invalidation failed: {e}")
        return 0
