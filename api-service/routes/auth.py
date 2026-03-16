from uuid import UUID
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging

from shared.db.controllers.user_controller import UserRepository, UserCreate
from shared.db.models.user import User
from shared.util.auth_dependencies import sign_token

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix='/auth', tags=['Auth'])


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    type: str = "bearer"
    user_id: str
    email: str
    username: str
    role: str


@router.options("/register")
@router.options("/login")
@router.options("/me")
async def options_handler():
    return {"status": "ok"}


def _validate_email(email: str) -> str:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        raise HTTPException(status_code=400, detail="Valid email is required")
    return normalized


def _validate_username(username: str) -> str:
    normalized = username.strip()
    if len(normalized) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    return normalized


def _build_auth_response(user: User) -> AuthResponse:
    token = sign_token({
        "user_id": str(user.user_id),
        "email": user.email,
        "username": user.username,
        "role": str(user.role.value if hasattr(user.role, "value") else user.role),
    })
    if not token:
        raise HTTPException(status_code=500, detail="Failed to generate token")

    return AuthResponse(
        token=token,
        type="bearer",
        user_id=str(user.user_id),
        email=user.email,
        username=user.username,
        role=str(user.role.value if hasattr(user.role, "value") else user.role),
    )


@router.post("/register", response_model=AuthResponse)
@limiter.limit("10/minute")
def register(request: Request, req: RegisterRequest):
    try:
        email = _validate_email(req.email)
        username = _validate_username(req.username)
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        if UserRepository.get_by_email(email):
            raise HTTPException(status_code=400, detail="Email already registered")

        user_id = UserRepository.create_user(UserCreate(
            email=email,
            username=username,
            password=req.password,
        ))
        user = UserRepository.get_by_id(UUID(str(user_id)))
        if not user:
            raise HTTPException(status_code=500, detail="Failed to load created user")

        UserRepository.update_last_login(UUID(str(user.user_id)))
        return _build_auth_response(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
def login(request: Request, req: LoginRequest):
    try:
        email = _validate_email(req.email)
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        user = UserRepository.verify_credentials(email, req.password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        UserRepository.update_last_login(UUID(str(user.user_id)))
        return _build_auth_response(user)

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
        "email": user.email,
        "username": user.username,
        "role": str(user.role.value if hasattr(user.role, "value") else user.role),
    }
