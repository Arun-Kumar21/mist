"""
Authentication dependencies for FastAPI routes
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional
from datetime import datetime, timedelta, UTC
import os
from dotenv import load_dotenv

from db.models.user import User, UserRole
from db.controllers.user_controller import UserRepository

load_dotenv()

security = HTTPBearer()

SECRET_KEY = os.getenv("SECRET_KEY")


def sign_token(data: dict) -> Optional[str]:
    """
    Create JWT token from data
    
    Args:
        data: Dictionary containing user data to encode
        
    Returns:
        JWT token string if successful, None otherwise
    """
    if not SECRET_KEY:
        return None 
    
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(days=7)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm='HS256')
    return encoded_jwt


class TokenData:
    """Token payload data structure"""
    def __init__(self, username: str, role: str):
        self.username = username
        self.role = role


def verify_token(token: str) -> Optional[TokenData]:
    """
    Verify and decode JWT token
    
    Args:
        token: JWT token string
        
    Returns:
        TokenData if valid, None otherwise
    """
    try:
        if not SECRET_KEY:
            return None
            
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        username: str = payload.get("username")
        role: str = payload.get("role")
        
        if username is None:
            return None
            
        return TokenData(username=username, role=role)
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """
    Dependency to get current authenticated user
    
    Args:
        credentials: HTTP Bearer token from request header
        
    Returns:
        User object
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = verify_token(credentials.credentials)
    
    if token_data is None:
        raise credentials_exception
        
    user = UserRepository.get_by_username(token_data.username)
    
    if user is None:
        raise credentials_exception
        
    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to verify user has admin role
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        User object if admin
        
    Raises:
        HTTPException: If user is not admin
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[User]:
    """
    Dependency to get current user if authenticated, None otherwise
    Useful for endpoints that work with or without authentication
    
    Args:
        credentials: Optional HTTP Bearer token from request header
        
    Returns:
        User object if authenticated, None otherwise
    """
    if credentials is None:
        return None
        
    token_data = verify_token(credentials.credentials)
    
    if token_data is None:
        return None
        
    user = UserRepository.get_by_username(token_data.username)
    return user
