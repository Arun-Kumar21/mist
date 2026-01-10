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
from db.models.user import User
from util.auth_dependencies import get_current_user, get_current_admin, sign_token

import logging

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix='/auth', tags=['Auth'])


class UserResponse(BaseModel):
    """User response model"""
    user_id: str
    username: str
    role: str
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Token response model"""
    token: str
    type: str = "bearer"


class RegisterResponse(BaseModel):
    """Registration response model"""
    success: bool
    user_id: str


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("10/minute")
def register(request: Request, req: UserCreate):
    """
    Create new user account
    
    Args:
        req: UserCreate with username and password
        
    Returns:
        RegisterResponse with success status and user_id
        
    Raises:
        HTTPException: For validation errors or if user already exists
    """
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

        return RegisterResponse(success=True, user_id=str(user_id))
    
    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"USER REGISTER ERROR: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, req: UserCreate):
    """
    Authenticate user and return JWT token
    
    Args:
        req: UserCreate with username and password
        
    Returns:
        TokenResponse with JWT token
        
    Raises:
        HTTPException: For validation errors or invalid credentials
    """
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
    """
    Get current authenticated user information
    
    Args:
        current_user: Authenticated user from token
        
    Returns:
        UserResponse with user information
    """
    return UserResponse(
        user_id=str(current_user.user_id),
        username=current_user.username,
        role=current_user.role
    )


@router.post("/logout")
def logout():
    """
    Logout endpoint (client should discard token)
    
    Returns:
        Success message
    """
    return {"success": True, "message": "Logged out successfully"}


@router.get("/profile", response_model=UserResponse)
def get_profile(request: Request):
    """
    Get current user profile using middleware authentication
    
    The middleware automatically adds user info to request.state
    
    Args:
        request: FastAPI request with user info in state
        
    Returns:
        UserResponse with user information
    """
    # User info is available via middleware in request.state
    user = request.state.user
    
    return UserResponse(
        user_id=str(user.user_id),
        username=user.username,
        role=user.role
    )



