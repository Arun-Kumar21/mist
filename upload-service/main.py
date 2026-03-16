from fastapi import FastAPI, APIRouter
import logging
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
import os

load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

# Prevent AWS SDK debug traces from overwhelming service logs.
for noisy_logger in ("boto3", "botocore", "s3transfer", "urllib3"):
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])

app = FastAPI(title="MIST Upload Service", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def _parse_allowed_origins() -> tuple[list[str], str | None]:
    env_origins = os.getenv("CLIENT_URLS", "")
    origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
    origin_regex = os.getenv("CLIENT_ORIGIN_REGEX")

    if not origins:
        for key in ("CLIENT_URL", "FRONTEND_URL", "NEXT_PUBLIC_APP_URL"):
            value = os.getenv(key, "").strip()
            if value:
                origins.append(value)

    if origins:
        return origins, origin_regex

    environment = os.getenv("ENVIRONMENT", "development").lower()
    if environment == "production":
        # Railway preview/prod domains usually end with `.up.railway.app`.
        return [], origin_regex or r"https://.*\.up\.railway\.app"

    return ["http://localhost:3000", "http://localhost:5173"], origin_regex


allowed_origins, allowed_origin_regex = _parse_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400,
)

from routes.upload import router as upload_router

API_PREFIX = "/api/v1"

health_router = APIRouter(prefix=API_PREFIX)

@health_router.get("/health")
def health():
    return {"status": "ok"}

app.include_router(health_router)
app.include_router(upload_router, prefix=API_PREFIX)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
