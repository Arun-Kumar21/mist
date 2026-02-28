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

    def __init__(self, app, enable_protection: bool = True):
        super().__init__(app)
        self.enable_protection = enable_protection
        logger.info(f"Auth middleware initialized (protection={'enabled' if enable_protection else 'disabled'})")

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        if not self.enable_protection:
            return await call_next(request)

        path = request.url.path
        method = request.method

        if is_public_route(path, method):
            return await call_next(request)

        is_optional = is_optional_auth_route(path)

        try:
            token = self._extract_token(request)

            if not token:
                if is_optional:
                    return await call_next(request)
                return self._unauthorized_response("Authentication required")

            token_data = verify_token(token)

            if token_data is None:
                if is_optional:
                    return await call_next(request)
                return self._unauthorized_response("Invalid or expired token")

            user = UserRepository.get_by_username(token_data.username)

            if user is None:
                if is_optional:
                    return await call_next(request)
                return self._unauthorized_response("User not found")

            if is_admin_route(path) and user.role != UserRole.ADMIN:
                return self._forbidden_response("Admin privileges required")

            request.state.user = user
            request.state.username = token_data.username
            request.state.role = token_data.role

        except Exception as e:
            logger.error(f"Auth middleware error: {e}")
            if is_optional:
                return await call_next(request)
            return self._unauthorized_response("Authentication failed")

        return await call_next(request)

    def _extract_token(self, request: Request) -> str | None:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None
        return parts[1]

    def _unauthorized_response(self, detail: str) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "detail": detail},
            headers={"WWW-Authenticate": "Bearer"}
        )

    def _forbidden_response(self, detail: str) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "detail": detail}
        )
