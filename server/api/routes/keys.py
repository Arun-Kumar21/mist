from fastapi import APIRouter, HTTPException, Response, Request
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config import settings
from db.controllers.track_encryption_keys_controller import TrackEncryptionKeysRepository

import logging

logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/keys",
    tags=["Keys"]
)


@router.options('/{track_id}')
async def keys_options(track_id: int):
    return Response(
        status_code=200,
        content=b'',
        headers={
            "Access-Control-Allow-Origin": settings.KEY_CORS_ORIGIN,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600"
        }
    )


@router.get('/{track_id}')
async def get_key(track_id: int, request: Request):
    if not hasattr(request.state, 'user'):
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        key_record = TrackEncryptionKeysRepository.get_by_track_id(track_id)

        if not key_record:
            raise HTTPException(status_code=404, detail="Key not found")

        key_bytes = key_record.get_key_bytes()

        if not key_bytes or len(key_bytes) != 16:
            logger.error(f"Invalid key length for track {track_id}: {len(key_bytes) if key_bytes else 0} bytes")
            raise HTTPException(status_code=500, detail="Invalid encryption key")

        return Response(
            content=key_bytes,
            media_type="application/octet-stream",
            headers={
                "Content-Length": "16",
                "Content-Type": "application/octet-stream",
                "Cache-Control": "no-store",
                "Access-Control-Allow-Origin": settings.KEY_CORS_ORIGIN,
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Expose-Headers": "Content-Length, Content-Type",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get key by track id error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


