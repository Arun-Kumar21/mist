"""
Decorators for route-level authentication and authorization
"""
from functools import wraps
from fastapi import Request, HTTPException, status
from typing import Callable
import logging

from db.models.user import UserRole

logger = logging.getLogger(__name__)


def require_auth(func: Callable) -> Callable:
    """
    Decorator to require authentication for a route
    
    Usage:
        @router.get("/protected")
        @require_auth
        async def protected_route(request: Request):
            user = request.state.user
            return {"message": f"Hello {user.username}"}
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request') or args[0]
        
        if not hasattr(request.state, 'user'):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        return await func(*args, **kwargs)
    
    return wrapper


def require_admin(func: Callable) -> Callable:
    """
    Decorator to require admin role for a route
    
    Usage:
        @router.delete("/admin/users/{user_id}")
        @require_admin
        async def delete_user(request: Request, user_id: int):
            # Only admins can access this
            pass
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request') or args[0]
        
        if not hasattr(request.state, 'user'):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        user = request.state.user
        
        if user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required"
            )
        
        return await func(*args, **kwargs)
    
    return wrapper


def get_current_user_from_request(request: Request):
    """
    Helper function to get current user from request state
    
    Args:
        request: FastAPI Request object
        
    Returns:
        User object if authenticated
        
    Raises:
        HTTPException: If user is not authenticated
    """
    if not hasattr(request.state, 'user'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    return request.state.user
