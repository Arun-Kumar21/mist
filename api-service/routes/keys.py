from fastapi import APIRouter, HTTPException, Response, Request
import logging

from shared.config import settings
from shared.db.controllers.track_encryption_keys_controller import TrackEncryptionKeysRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/keys", tags=["Keys"])


@router.options('/{track_id}')
async def keys_options(track_id: int, request: Request):
    cors_origin = settings.get_key_cors_origin(request.headers.get("origin"))
    return Response(
        status_code=200,
        content=b'',
        headers={
            "Access-Control-Allow-Origin": cors_origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
            "Vary": "Origin",
        }
    )


@router.get('/{track_id}')
async def get_key(track_id: int, request: Request):
    if not hasattr(request.state, 'user'):
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        cors_origin = settings.get_key_cors_origin(request.headers.get("origin"))

        key_record = TrackEncryptionKeysRepository.get_by_track_id(track_id)
        if not key_record:
            raise HTTPException(status_code=404, detail="Key not found")

        key_bytes = key_record.get_key_bytes()
        if not key_bytes or len(key_bytes) != 16:
            raise HTTPException(status_code=500, detail="Invalid encryption key")

        return Response(
            content=key_bytes,
            media_type="application/octet-stream",
            headers={
                "Content-Length": "16",
                "Cache-Control": "no-store",
                "Access-Control-Allow-Origin": cors_origin,
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Expose-Headers": "Content-Length, Content-Type",
                "Vary": "Origin",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get key error for track {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
