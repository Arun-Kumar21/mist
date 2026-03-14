from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging
from uuid import UUID

from shared.util.auth_dependencies import verify_token
from shared.db.controllers.user_controller import UserRepository
from .config import is_public_route, is_admin_route
from shared.db.models.user import UserRole

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):

    def __init__(self, app, enable_protection: bool = True):
        super().__init__(app)
        self.enable_protection = enable_protection

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        if not self.enable_protection:
            return await call_next(request)

        path = request.url.path
        method = request.method

        if is_public_route(path, method):
            return await call_next(request)

        try:
            token = self._extract_token(request)

            if not token:
                return self._unauthorized("Authentication required")

            token_data = verify_token(token)
            if token_data is None:
                return self._unauthorized("Invalid or expired token")

            try:
                user = UserRepository.get_by_id(UUID(token_data.user_id))
            except ValueError:
                return self._unauthorized("Invalid token subject")
            if user is None:
                return self._unauthorized("User not found")

            if is_admin_route(path) and user.role != UserRole.ADMIN:
                return self._forbidden("Admin privileges required")

            request.state.user = user
            request.state.user_id = str(user.user_id)
            request.state.username = user.username
            request.state.email = user.email
            request.state.role = token_data.role

        except Exception as e:
            logger.error(f"Auth middleware error: {e}")
            return self._unauthorized("Authentication failed")

        return await call_next(request)

    def _extract_token(self, request: Request) -> str | None:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        return auth_header.split(" ", 1)[1]

    def _unauthorized(self, detail: str):
        return JSONResponse(status_code=401, content={"detail": detail})

    def _forbidden(self, detail: str):
        return JSONResponse(status_code=403, content={"detail": detail})
