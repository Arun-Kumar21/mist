from fastapi import FastAPI, APIRouter, Request
import sys
from pathlib import Path
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings
from api.routes.upload import router as upload_router
from api.routes.tracks import router as track_router
from api.routes.keys import router as key_router
from api.routes.auth import router as auth_router
from api.routes.listen import router as listen_router
from api.routes.admin import router as admin_router
from api.middleware import AuthMiddleware, IPBlockMiddleware

# Validate production config
settings.validate()
settings.print_config()

logger = logging.getLogger(__name__)
logging.basicConfig(level=settings.LOG_LEVEL)

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(
    title="MIST Music Platform API",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from fastapi.middleware.cors import CORSMiddleware

# Add IP blocking middleware (first to check blocks before anything else)
app.add_middleware(
    IPBlockMiddleware,
    enable_blocking=True
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Add Authentication middleware for route protection
app.add_middleware(
    AuthMiddleware,
    enable_protection=True  
)

API_PREFIX = "/api/v1"

router = APIRouter(prefix=API_PREFIX)

@router.get("/health")
def check_server_health():
    return {"status": "ok"}


app.include_router(router)

# Auth routes
app.include_router(auth_router, prefix=API_PREFIX)

# Upload routes
app.include_router(upload_router, prefix=API_PREFIX)

# Tracks routes
app.include_router(track_router, prefix=API_PREFIX)

# Listen routes
app.include_router(listen_router, prefix=API_PREFIX)

# Admin routes
app.include_router(admin_router, prefix=API_PREFIX)

# Key route (at /api/v1/keys)
app.include_router(key_router, prefix=API_PREFIX)

# Key route backward compatibility (at /api/keys for old HLS playlists)
app.include_router(key_router, prefix="/api")
logger.info("Keys endpoint registered at /api/v1/keys and /api/keys (backward compatibility)")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)