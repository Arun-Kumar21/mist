from functools import wraps
from fastapi import Request, HTTPException, status
from typing import Callable
from shared.db.models.user import UserRole


def require_auth(func: Callable) -> Callable:
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request') or args[0]
        if not hasattr(request.state, 'user'):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        return await func(*args, **kwargs)
    return wrapper


def require_admin(func: Callable) -> Callable:
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request') or args[0]
        if not hasattr(request.state, 'user'):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        if request.state.user.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
        return await func(*args, **kwargs)
    return wrapper


def get_current_user_from_request(request: Request):
    if not hasattr(request.state, 'user'):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return request.state.user
