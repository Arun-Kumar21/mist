from fastapi import FastAPI, APIRouter
import sys
from pathlib import Path
import logging
import os

from routes.upload import router as upload_router
from routes.tracks import router as track_router

sys.path.insert(0, str(Path(__file__).parent.parent))



logger = logging.getLogger(__name__)

app = FastAPI()

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')
CLIENT_URL = os.getenv("CLIENT_URL", 'http://localhost:3000')

from fastapi.middleware.cors import CORSMiddleware


app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_URL], 
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

router = APIRouter(prefix=API_PREFIX)

@router.get("/health")
def check_server_health():
    return {"status": "ok"}


app.include_router(router)

# Upload routes
app.include_router(upload_router, prefix=API_PREFIX)

# Track routes
app.include_router(track_router, prefix=API_PREFIX)

if __name__ == "__main__":
    import uvicorn
    PORT = os.getenv('PORT', 8000)
    HOST = os.getenv('HOST', '0.0.0.0')
    uvicorn.run(app, host=HOST, port=int(PORT))