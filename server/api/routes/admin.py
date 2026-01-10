from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import logging

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.controllers.blocked_ip_controller import BlockedIPRepository
from api.middleware import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


class BlockIPRequest(BaseModel):
    ip_address: str
    reason: Optional[str] = None
    duration_hours: Optional[int] = None


class UnblockIPRequest(BaseModel):
    ip_address: str


@router.post("/block-ip")
@require_admin
async def block_ip(req: BlockIPRequest, request: Request):
    """Block an IP address (admin only)"""
    try:
        blocked_id = BlockedIPRepository.block_ip(
            req.ip_address,
            req.reason,
            req.duration_hours
        )
        
        logger.info(f"Admin {request.state.username} blocked IP: {req.ip_address}")
        
        return {
            "success": True,
            "blocked_id": blocked_id,
            "ip_address": req.ip_address,
            "permanent": req.duration_hours is None
        }
    except Exception as e:
        logger.error(f"Error blocking IP: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unblock-ip")
@require_admin
async def unblock_ip(req: UnblockIPRequest, request: Request):
    """Unblock an IP address (admin only)"""
    try:
        success = BlockedIPRepository.unblock_ip(req.ip_address)
        
        if not success:
            raise HTTPException(status_code=404, detail="IP not found in blocklist")
        
        logger.info(f"Admin {request.state.username} unblocked IP: {req.ip_address}")
        
        return {
            "success": True,
            "ip_address": req.ip_address
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unblocking IP: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/blocked-ips")
@require_admin
async def get_blocked_ips(request: Request):
    """Get all blocked IPs (admin only)"""
    try:
        blocked_ips = BlockedIPRepository.get_all_blocked()
        
        return {
            "success": True,
            "count": len(blocked_ips),
            "blocked_ips": [ip.to_dict() for ip in blocked_ips]
        }
    except Exception as e:
        logger.error(f"Error fetching blocked IPs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup-expired-blocks")
@require_admin
async def cleanup_expired_blocks(request: Request):
    """Cleanup expired IP blocks (admin only)"""
    try:
        count = BlockedIPRepository.cleanup_expired()
        
        logger.info(f"Admin {request.state.username} cleaned up {count} expired blocks")
        
        return {
            "success": True,
            "removed_count": count
        }
    except Exception as e:
        logger.error(f"Error cleaning up blocks: {e}")
        raise HTTPException(status_code=500, detail=str(e))
