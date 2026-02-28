from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from db.controllers.user_controller import UserRepository, UserCreate
from db.controllers.analytics_controller import AnalyticsRepository
from db.models.user import User
from util.auth_dependencies import get_current_user, get_current_admin, sign_token

import logging

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix='/auth', tags=['Auth'])


class UserResponse(BaseModel):
    user_id: str
    username: str
    role: str

    class Config:
        from_attributes = True


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
async def options_handler():
    return {"status": "ok"}


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("10/minute")
def register(request: Request, req: UserCreate):
    try:
        if not req.username or not req.password:
            raise HTTPException(status_code=400, detail="Username and password are required")
        if len(req.username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters long")
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

        exists = UserRepository.get_by_username(req.username)
        if exists:
            raise HTTPException(status_code=400, detail="Username already taken")

        user_id = UserRepository.create_user(req)
        user = UserRepository.get_by_username(req.username)

        token = sign_token({"username": user.username, "role": user.role})
        if not token:
            raise HTTPException(status_code=500, detail="Failed to generate token")

        return RegisterResponse(
            token=token,
            type="bearer",
            user_id=str(user.user_id),
            username=user.username,
            role=user.role
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"USER REGISTER ERROR: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, req: UserCreate):
    try:
        if not req.username or not req.password:
            raise HTTPException(status_code=400, detail="Username and password are required")

        if len(req.username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters long") 
        
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

        user = UserRepository.verify_credentials(req.username, req.password)        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password") 
         
        UserRepository.update_last_login(UUID(str(user.user_id)))
        
        data = {
            "username": user.username,
            "role": user.role
        }
        token = sign_token(data)

        if not token:
            logger.error("Failed to sign token")
            raise HTTPException(status_code=500, detail="Failed to generate token")

        return TokenResponse(token=token, type="bearer")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"USER LOGIN ERROR: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(
        user_id=str(current_user.user_id),
        username=current_user.username,
        role=current_user.role
    )


@router.post("/logout")
def logout():
    return {"success": True, "message": "Logged out successfully"}


@router.get("/profile", response_model=UserResponse)
def get_profile(request: Request):
    user = request.state.user
    return UserResponse(
        user_id=str(user.user_id),
        username=user.username,
        role=user.role
    )


@router.get("/me/stats")
def get_user_stats(request: Request):
    try:
        user = request.state.user
        user_id = str(user.user_id)
        stats = AnalyticsRepository.get_user_stats(user_id)
        top_genres = AnalyticsRepository.get_user_top_genres(user_id)
        top_artists = AnalyticsRepository.get_user_top_artists(user_id)
        return {
            "success": True,
            "stats": stats,
            "top_genres": top_genres,
            "top_artists": top_artists
        }
    except Exception as e:
        logger.error(f"Error fetching user stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))