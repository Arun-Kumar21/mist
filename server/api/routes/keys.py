from fastapi import APIRouter, HTTPException, Response
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
    """Handle CORS preflight for key requests"""
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
async def get_key(track_id: int):
    """
    Returns raw 16-byte AES-128 encryption key for HLS player decryption.
    This endpoint is called by HLS players when they encounter #EXT-X-KEY directive.
    
    IMPORTANT: Returns binary data, not JSON!
    """
    try:
        key_record = TrackEncryptionKeysRepository.get_by_track_id(track_id)

        if not key_record:
            raise HTTPException(status_code=404, detail="Key not found")
        
        key_bytes = key_record.get_key_bytes()
        
        if not key_bytes or len(key_bytes) != 16:
            logger.error(f"Invalid key length for track {track_id}: {len(key_bytes) if key_bytes else 0} bytes")
            raise HTTPException(status_code=500, detail="Invalid encryption key")
        
        logger.info(f"Serving encryption key for track {track_id} ({len(key_bytes)} bytes)")
        
        return Response(
            content=key_bytes,
            media_type="application/octet-stream",
            headers={
                "Content-Length": "16",
                "Content-Type": "application/octet-stream",
                "Cache-Control": "public, max-age=31536000",
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

