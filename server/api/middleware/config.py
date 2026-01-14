from typing import Set

# Define which routes should be accessible without authentication
PUBLIC_ROUTES: Set[str] = {
    # Health check
    "/api/v1/health",
    
    # Authentication routes
    "/api/v1/auth/register",
    "/api/v1/auth/login",
}

# Define route prefixes that should be public
PUBLIC_PREFIXES: Set[str] = {
    "/api/v1/tracks",
    "/api/v1/proxy",   # HLS proxy for development
    "/api/v1/keys",    # Decryption keys
}

# Routes that support optional authentication (check token if present, but don't require it)
OPTIONAL_AUTH_PREFIXES: Set[str] = {
    "/api/v1/listen",
}

# Routes that require admin privileges
ADMIN_ROUTES: Set[str] = {
    "/api/v1/admin",
}

ADMIN_PREFIXES: Set[str] = {
    "/api/v1/admin/",
    "/api/v1/upload",
}


def is_public_route(path: str) -> bool:
    """
    Check if a route should be publicly accessible
    
    Args:
        path: Request path
        
    Returns:
        True if route is public, False otherwise
    """
    # Check exact matches
    if path in PUBLIC_ROUTES:
        return True
    
    # Check prefixes
    for prefix in PUBLIC_PREFIXES:
        if path.startswith(prefix):
            return True
    
    return False


def is_optional_auth_route(path: str) -> bool:
    """
    Check if a route supports optional authentication
    
    Args:
        path: Request path
        
    Returns:
        True if route has optional auth, False otherwise
    """
    # Check prefixes
    for prefix in OPTIONAL_AUTH_PREFIXES:
        if path.startswith(prefix):
            return True
    
    return False


def is_admin_route(path: str) -> bool:
    """
    Check if a route requires admin privileges
    
    Args:
        path: Request path
        
    Returns:
        True if route requires admin, False otherwise
    """
    # Check exact matches
    if path in ADMIN_ROUTES:
        return True
    
    # Check prefixes
    for prefix in ADMIN_PREFIXES:
        if path.startswith(prefix):
            return True
    
    return False


def add_public_route(route: str) -> None:
    """
    Dynamically add a route to the public routes set
    
    Args:
        route: Route path to make public
    """
    PUBLIC_ROUTES.add(route)


def add_public_prefix(prefix: str) -> None:
    """
    Dynamically add a prefix to the public prefixes set
    
    Args:
        prefix: Route prefix to make public
    """
    PUBLIC_PREFIXES.add(prefix)
