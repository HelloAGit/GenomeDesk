import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-process sliding-window limiter per client address (single-instance deployments).

    Behind a reverse proxy configure uvicorn --proxy-headers so client addresses differ.
    Use an edge/Redis limiter for multi-replica deployments.
    """

    def __init__(self, app, general: int, auth: int):
        super().__init__(app)
        self.limits = {"general": general, "auth": auth}
        self.hits: dict[tuple[str, str], deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path == "/health" or request.method == "OPTIONS":
            return await call_next(request)
        bucket = "auth" if path.startswith("/api/auth/") else "general"
        limit = self.limits[bucket]
        if limit > 0:
            now = time.monotonic()
            window = self.hits[(request.client.host if request.client else "?", bucket)]
            while window and now - window[0] > 60:
                window.popleft()
            if len(window) >= limit:
                return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429,
                                    headers={"Retry-After": "60"})
            window.append(now)
        return await call_next(request)
