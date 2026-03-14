from uuid import UUID
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging

from shared.db.controllers.user_controller import UserRepository, UserCreate
from shared.util.auth_dependencies import sign_token

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix='/auth', tags=['Auth'])


class TokenResponse(BaseModel):
    token: str
    type: str = "bearer"


class RegisterResponse(BaseModel):
    token: str
    type: str = "bearer"
    user_id: str
    username: str
    role: str


@router.options("/register")
@router.options("/login")
@router.options("/me")
async def options_handler():
    return {"status": "ok"}


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("10/minute")
def register(request: Request, req: UserCreate):
    try:
        if not req.username or not req.password:
            raise HTTPException(status_code=400, detail="Username and password are required")
        if len(req.username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        if UserRepository.get_by_username(req.username):
            raise HTTPException(status_code=400, detail="Username already taken")

        UserRepository.create_user(req)
        user = UserRepository.get_by_username(req.username)
        token = sign_token({"username": user.username, "role": user.role})
        if not token:
            raise HTTPException(status_code=500, detail="Failed to generate token")

        return RegisterResponse(
            token=token, type="bearer",
            user_id=str(user.user_id), username=user.username, role=user.role
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, req: UserCreate):
    try:
        if not req.username or not req.password:
            raise HTTPException(status_code=400, detail="Username and password are required")
        if len(req.username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        user = UserRepository.verify_credentials(req.username, req.password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        UserRepository.update_last_login(UUID(str(user.user_id)))
        token = sign_token({"username": user.username, "role": user.role})
        if not token:
            raise HTTPException(status_code=500, detail="Failed to generate token")

        return TokenResponse(token=token, type="bearer")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/me")
def get_current_user_profile(request: Request):
    if not hasattr(request.state, "user"):
        raise HTTPException(status_code=401, detail="Authentication required")

    user = request.state.user
    return {
        "user_id": str(user.user_id),
        "username": user.username,
        "role": str(user.role),
    }
