from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.controllers.blocked_ip_controller import BlockedIPRepository

logger = logging.getLogger(__name__)


class IPBlockMiddleware(BaseHTTPMiddleware):
    """Middleware to block requests from blacklisted IPs"""
    
    def __init__(self, app, enable_blocking: bool = True):
        super().__init__(app)
        self.enable_blocking = enable_blocking
        logger.info(f"IP block middleware initialized (blocking={'enabled' if enable_blocking else 'disabled'})")
    
    async def dispatch(self, request: Request, call_next):
        # Skip all processing for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        if not self.enable_blocking:
            return await call_next(request)
        
        # Only check IP blocks for non-OPTIONS requests
        ip_address = request.client.host
        
        if BlockedIPRepository.is_blocked(ip_address):
            logger.warning(f"Blocked request from IP: {ip_address}")
            return JSONResponse(
                status_code=403,
                content={
                    "success": False,
                    "detail": "Access denied. Your IP has been blocked."
                }
            )
        
        response = await call_next(request)
        return response
