from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional
from datetime import datetime, timedelta, UTC
from uuid import UUID
import os
from dotenv import load_dotenv

from shared.db.models.user import User, UserRole
from shared.db.controllers.user_controller import UserRepository

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
    def __init__(self, user_id: str, role: str, email: str | None = None, username: str | None = None):
        self.user_id = user_id
        self.role = role
        self.email = email
        self.username = username


def verify_token(token: str) -> Optional[TokenData]:
    try:
        if not SECRET_KEY:
            return None
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id: str = payload.get("user_id")
        role: str = payload.get("role")
        email: str | None = payload.get("email")
        username: str | None = payload.get("username")
        if user_id is None:
            return None
        return TokenData(user_id=user_id, role=role, email=email, username=username)
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    token_data = verify_token(credentials.credentials)
    if token_data is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    try:
        user = UserRepository.get_by_id(UUID(token_data.user_id))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject") from exc
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user
