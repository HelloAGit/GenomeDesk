import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.db.models import User

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,}$")


class UserError(ValueError):
    pass


def create_user(session: Session, email: str, display_name: str, password: str) -> User:
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise UserError("Invalid email address")
    if len(password) < 12:
        raise UserError("Password must be at least 12 characters")
    if not display_name.strip() or len(display_name) > 100:
        raise UserError("Display name must be 1-100 characters")
    if session.scalar(select(User).where(User.email == email)):
        raise UserError("Email already registered")
    user = User(email=email, display_name=display_name.strip(), password_hash=hash_password(password))
    session.add(user)
    session.flush()
    return user
