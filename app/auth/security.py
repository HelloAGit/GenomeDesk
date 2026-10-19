"""Password hashing (scrypt) and signed, expiring bearer tokens (HMAC-SHA256)."""
import base64
import hashlib
import hmac
import json
import secrets
import time

_N, _R, _P = 2 ** 14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P)
    return f"scrypt${_N}${_R}${_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt),
                                   n=int(n), r=int(r), p=int(p))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate.hex(), digest)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue_token(user_id: str, secret: str, ttl_minutes: int, now: float | None = None) -> str:
    payload = _b64(json.dumps({"sub": user_id, "exp": int((time.time() if now is None else now) + ttl_minutes * 60)}).encode())
    sig = _b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_token(token: str, secret: str, now: float | None = None) -> str | None:
    try:
        payload, sig = token.split(".")
        expected = _b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(_unb64(payload))
        if data["exp"] < (time.time() if now is None else now):
            return None
        return str(data["sub"])
    except (ValueError, KeyError, TypeError):
        return None
