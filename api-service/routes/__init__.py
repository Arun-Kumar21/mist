from routes.auth import router as auth_router
from routes.tracks import router as tracks_router
from routes.listen import router as listen_router
from routes.keys import router as keys_router
from routes.banner import router as banner_router

__all__ = ["auth_router", "tracks_router", "listen_router", "keys_router", "banner_router"]
