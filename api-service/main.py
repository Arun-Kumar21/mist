from fastapi import FastAPI, APIRouter
import logging
import threading
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from shared.config import settings
from shared.db.database import create_tables
import shared.db.models  # noqa: F401 — ensures all models are registered with Base
from routes.auth import router as auth_router
from routes.tracks import router as track_router
from routes.keys import router as key_router
from routes.listen import router as listen_router
from routes.banner import router as banner_router
from routes.home import router as home_router
from routes.curation import router as curation_router
from routes.library import router as library_router
from middleware import AuthMiddleware

settings.validate()

logging.basicConfig(level=settings.LOG_LEVEL)

for noisy_logger in ("boto3", "botocore", "s3transfer", "urllib3"):
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(title="MIST API", version="1.0.0")


def _initialize_database() -> None:
    try:
        create_tables()
        logger.info("Database tables ready")
    except Exception:
        logger.exception("Database initialization failed; API will start and retry on next deploy/restart")

@app.on_event("startup")
async def on_startup():
    threading.Thread(target=_initialize_database, daemon=True).start()

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(AuthMiddleware, enable_protection=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)

API_PREFIX = "/api/v1"

router = APIRouter(prefix=API_PREFIX)

@app.get("/health")
def root_health():
    return {"status": "ok"}

@router.get("/health")
def health():
    return {"status": "ok"}

app.include_router(router)
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(track_router, prefix=API_PREFIX)
app.include_router(listen_router, prefix=API_PREFIX)
app.include_router(key_router, prefix=API_PREFIX)
app.include_router(key_router, prefix="/api")
app.include_router(banner_router, prefix=API_PREFIX)
app.include_router(home_router, prefix=API_PREFIX)
app.include_router(curation_router, prefix=API_PREFIX)
app.include_router(library_router, prefix=API_PREFIX)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
