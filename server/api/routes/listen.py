from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import logging

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from services.listening_service import ListeningService
from db.controllers import TrackRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/listen", tags=["Listening"])


class ListenStartRequest(BaseModel):
    track_id: int


class ListenHeartbeatRequest(BaseModel):
    session_id: int
    current_time: float


class ListenCompleteRequest(BaseModel):
    session_id: int
    total_duration: float


@router.post("/start")
async def start_listening(req: ListenStartRequest, request: Request):
    """Start a listening session and check quota"""
    try:
        if not hasattr(request.state, 'user'):
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user = request.state.user
        user_id = str(user.user_id)
        ip_address = request.client.host
        
        track = TrackRepository.get_by_id(req.track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        
        quota_info = ListeningService.check_quota_available(user_id, ip_address, user)
        
        if not quota_info["has_quota"]:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Daily listening quota exceeded",
                    "quota_limit": quota_info["quota_limit"],
                    "minutes_used": quota_info["minutes_used"]
                }
            )
        
        session_id = ListeningService.start_listening_session(user_id, req.track_id, ip_address)
        ListeningService.increment_track_started(user_id, ip_address)
        
        return {
            "success": True,
            "session_id": session_id,
            "track_id": req.track_id,
            "quota": quota_info
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting listen session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/heartbeat")
async def listening_heartbeat(req: ListenHeartbeatRequest, request: Request):
    """Update listening progress and quota in real-time"""
    try:
        if not hasattr(request.state, 'user'):
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(request.state.user.user_id)
        ip_address = request.client.host
        
        success = ListeningService.update_listening_progress(
            req.session_id,
            req.current_time,
            user_id,
            ip_address
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Return updated quota info
        user = request.state.user
        quota_info = ListeningService.check_quota_available(user_id, ip_address, user)
        
        return {
            "success": True,
            "quota": quota_info
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating heartbeat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete")
async def complete_listening(req: ListenCompleteRequest, request: Request):
    """Complete listening session and update quota"""
    try:
        if not hasattr(request.state, 'user'):
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(request.state.user.user_id)
        ip_address = request.client.host
        
        success = ListeningService.complete_listening_session(
            req.session_id,
            req.total_duration,
            user_id,
            ip_address
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        quota_info = ListeningService.check_quota_available(user_id, ip_address, request.state.user)
        
        return {
            "success": True,
            "quota": quota_info
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing listen session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quota")
async def get_quota_status(request: Request):
    """Get current quota status"""
    try:
        if not hasattr(request.state, 'user'):
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user = request.state.user
        user_id = str(user.user_id)
        ip_address = request.client.host
        
        quota_info = ListeningService.check_quota_available(user_id, ip_address, user)
        
        return {
            "success": True,
            "quota": quota_info
        }
    
    except Exception as e:
        logger.error(f"Error getting quota status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
