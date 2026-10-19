"""Create users without opening registration: python -m app.auth.cli EMAIL NAME (password from stdin prompt)."""
import getpass
import sys

from app.config import Settings
from app.db.session import init_db, make_engine, make_session_factory
from app.services.users import create_user


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python -m app.auth.cli EMAIL DISPLAY_NAME")
        return 2
    settings = Settings()
    engine = make_engine(settings.resolved_database_url())
    factory = make_session_factory(engine)
    init_db(engine, factory)
    password = getpass.getpass("Password (min 12 chars): ")
    with factory() as session, session.begin():
        user = create_user(session, argv[0], argv[1], password)
    print(f"Created user {user.id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
