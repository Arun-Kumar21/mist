from typing import Set

PUBLIC_ROUTES: Set[str] = {
    "/api/v1/health",
    "/api/v1/auth/register",
    "/api/v1/auth/login",
}

PUBLIC_PREFIXES: Set[str] = {}

PUBLIC_GET_ROUTES: Set[str] = {
    "/api/v1/tracks",
}

EXCLUDED_FROM_PUBLIC: Set[str] = {
    "/api/v1/tracks/",
}

OPTIONAL_AUTH_PREFIXES: Set[str] = {}

ADMIN_ROUTES: Set[str] = {
    "/api/v1/admin",
}

ADMIN_PREFIXES: Set[str] = {
    "/api/v1/admin/",
    "/api/v1/upload",
}


def is_public_route(path: str, method: str = "GET") -> bool:
    if path in PUBLIC_ROUTES:
        return True
    for prefix in PUBLIC_PREFIXES:
        if path.startswith(prefix):
            return True
    if method == "GET":
        import re
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
    for prefix in OPTIONAL_AUTH_PREFIXES:
        if path.startswith(prefix):
            return True
    return False


def is_admin_route(path: str) -> bool:
    if path in ADMIN_ROUTES:
        return True
    for prefix in ADMIN_PREFIXES:
        if path.startswith(prefix):
            return True
    return False


def add_public_route(route: str) -> None:
    PUBLIC_ROUTES.add(route)


def add_public_prefix(prefix: str) -> None:
    PUBLIC_PREFIXES.add(prefix)
