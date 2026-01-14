from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Set
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from util.auth_dependencies import verify_token
from db.controllers.user_controller import UserRepository
from .config import is_public_route, is_admin_route, is_optional_auth_route
from db.models.user import UserRole

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to protect routes requiring authentication
    """
    
    def __init__(self, app, enable_protection: bool = True):
        """
        Initialize auth middleware
        
        Args:
            app: FastAPI application instance
            enable_protection: Whether to enable route protection 
        """
        super().__init__(app)
        self.enable_protection = enable_protection
        logger.info(f"Auth middleware initialized (protection={'enabled' if enable_protection else 'disabled'})")
    
    async def dispatch(self, request: Request, call_next):
        """
        Process each request through the middleware
        
        Args:
            request: Incoming request
            call_next: Next middleware or route handler
            
        Returns:
            Response from the route handler or error response
        """
        # Fast-path: Skip all processing for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        if not self.enable_protection:
            return await call_next(request)
        
        path = request.url.path
        method = request.method
        
        if is_public_route(path, method):
            return await call_next(request)
        
        # Check if this is an optional auth route
        is_optional = is_optional_auth_route(path)
        
        # Extract and validate token
        try:
            token = self._extract_token(request)
            
            if not token:
                if is_optional:
                    # For optional auth, allow request without token
                    return await call_next(request)
                return self._unauthorized_response("Authentication required")
            
            # Verify token
            token_data = verify_token(token)
            
            if token_data is None:
                if is_optional:
                    # For optional auth, allow request with invalid token (treat as guest)
                    logger.debug(f"Optional auth route with invalid token, treating as guest")
                    return await call_next(request)
                return self._unauthorized_response("Invalid or expired token")
            
            user = UserRepository.get_by_username(token_data.username)
            
            if user is None:
                if is_optional:
                    # For optional auth, allow request if user not found
                    return await call_next(request)
                return self._unauthorized_response("User not found")
            
            # Check if route requires admin privileges
            if is_admin_route(path) and user.role != UserRole.ADMIN:
                return self._forbidden_response("Admin privileges required")
            
            request.state.user = user
            request.state.username = token_data.username
            request.state.role = token_data.role
            
            logger.debug(f"Authenticated request from user: {token_data.username}")
            
        except Exception as e:
            logger.error(f"Auth middleware error: {e}")
            if is_optional:
                # For optional auth routes, allow request even on error
                return await call_next(request)
            return self._unauthorized_response("Authentication failed")
        
        # Continue to route handler
        response = await call_next(request)
        return response
    
    def _extract_token(self, request: Request) -> str | None:
        """
        Extract JWT token from Authorization header
        
        Args:
            request: Incoming request
            
        Returns:
            Token string or None if not found
        """
        auth_header = request.headers.get("Authorization")
        
        if not auth_header:
            return None
        
        # Expected format: "Bearer <token>"
        parts = auth_header.split()
        
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None
        
        return parts[1]
    
    def _unauthorized_response(self, detail: str) -> JSONResponse:
        """
        Create unauthorized response
        
        Args:
            detail: Error message
            
        Returns:
            JSONResponse with 401 status
        """
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "success": False,
                "detail": detail
            },
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    def _forbidden_response(self, detail: str) -> JSONResponse:
        """
        Create forbidden response
        
        Args:
            detail: Error message
            
        Returns:
            JSONResponse with 403 status
        """
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "detail": detail
            }
        )
