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
    if not SECRET_KEY:
        return None
    to_encode = data.copy()
    to_encode.update({"exp": datetime.now(UTC) + timedelta(days=7)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm='HS256')


class TokenData:
    def __init__(self, username: str, role: str):
        self.username = username
        self.role = role


def verify_token(token: str) -> Optional[TokenData]:
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
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[User]:
    if credentials is None:
        return None
    token_data = verify_token(credentials.credentials)
    if token_data is None:
        return None
    return UserRepository.get_by_username(token_data.username)
