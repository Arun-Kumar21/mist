from fastapi import FastAPI, APIRouter
import logging
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from shared.config import settings
from routes.auth import router as auth_router
from routes.tracks import router as track_router
from routes.keys import router as key_router
from routes.listen import router as listen_router
from routes.admin import router as admin_router
from middleware import AuthMiddleware

settings.validate()

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(title="MIST API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

app.add_middleware(AuthMiddleware, enable_protection=True)

API_PREFIX = "/api/v1"

router = APIRouter(prefix=API_PREFIX)

@router.get("/health")
def health():
    return {"status": "ok"}

app.include_router(router)
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(track_router, prefix=API_PREFIX)
app.include_router(listen_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)
app.include_router(key_router, prefix=API_PREFIX)
app.include_router(key_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
