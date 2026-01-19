from typing import Set

# Define which routes should be accessible without authentication
PUBLIC_ROUTES: Set[str] = {
    # Health check
    "/api/v1/health",
    
    # Authentication routes
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/guest"
}

# Define route prefixes that should be public
PUBLIC_PREFIXES: Set[str] = {
    "/api/v1/keys",    # Decryption keys (new path)
    "/api/keys",       # Decryption keys (backward compatibility for old HLS playlists)
}

# Define specific routes that should be public (for GET requests only on tracks)
PUBLIC_GET_ROUTES: Set[str] = {
    "/api/v1/tracks",  # Only GET requests for listing/viewing tracks
}

# Specific routes to exclude from public access even if they match public patterns
EXCLUDED_FROM_PUBLIC: Set[str] = {
    "/api/v1/tracks/",  # Exclude routes like /tracks/{id}/stream, /tracks/{id}/similar
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


def is_public_route(path: str, method: str = "GET") -> bool:
    """
    Check if a route should be publicly accessible
    
    Args:
        path: Request path
        method: HTTP method
        
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
    
    # Check GET-only public routes
    if method == "GET":
        import re
        # Allow listing tracks, getting single track, search, popular, similar
        if path == "/api/v1/tracks" or re.match(r'^/api/v1/tracks\?', path):
            return True
        if re.match(r'^/api/v1/tracks/\d+$', path):
            return True
        if path.startswith("/api/v1/tracks/search"):
            return True
        if path == "/api/v1/tracks/popular":
            return True
        if re.match(r'^/api/v1/tracks/\d+/similar', path):
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
    
    # Make /tracks/{id}/stream use optional auth (checks for user, falls back to IP)
    import re
    if re.match(r'^/api/v1/tracks/\d+/stream$', path):
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
