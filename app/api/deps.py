import secrets
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import verify_token
from app.db.models import Project, ProjectMembership, User
from app.db.session import DEFAULT_PROJECT_ID

key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer = HTTPBearer(auto_error=False)
ROLE_RANK = {"viewer": 1, "editor": 2, "owner": 3}
LEGACY_ACTOR = "dev-api-key"


@dataclass
class Principal:
    actor: str
    user: User | None = None

    @property
    def legacy(self) -> bool:
        return self.user is None


@dataclass
class ProjectCtx:
    project: Project
    principal: Principal
    role: str

    def require(self, minimum: str) -> None:
        if ROLE_RANK[self.role] < ROLE_RANK[minimum]:
            raise HTTPException(403, f"Requires {minimum} role in this project")


def get_session(request: Request):
    with request.app.state.session_factory() as session:
        yield session  # handlers commit explicitly; uncommitted work is rolled back on close


def authenticate(request: Request, key: str | None = Depends(key_header),
                 token: HTTPAuthorizationCredentials | None = Depends(bearer),
                 session: Session = Depends(get_session)) -> Principal:
    settings = request.app.state.settings
    if token is not None:
        if not settings.multi_user_enabled:
            raise HTTPException(503, "Identity-based authentication is not configured")
        user_id = verify_token(token.credentials, settings.auth_secret_key)
        user = session.get(User, user_id) if user_id else None
        if user is None or not user.is_active:
            raise HTTPException(401, "Invalid or expired token")
        return Principal(actor=user.id, user=user)
    if not settings.legacy_api_key_enabled or not settings.backend_api_key:
        if not settings.multi_user_enabled:
            raise HTTPException(503, "Set BACKEND_API_KEY before using this API")
        raise HTTPException(401, "Authentication required")
    if not key or not secrets.compare_digest(key, settings.backend_api_key):
        raise HTTPException(401, "Invalid API key")
    return Principal(actor=LEGACY_ACTOR)


def load_project(session: Session, principal: Principal, project_id: str) -> ProjectCtx:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if principal.legacy:
        if project.id != DEFAULT_PROJECT_ID:
            raise HTTPException(404, "Project not found")
        return ProjectCtx(project, principal, "owner")
    membership = session.query(ProjectMembership).filter_by(
        project_id=project_id, user_id=principal.user.id).one_or_none()
    if membership is None:  # 404, not 403: do not reveal other projects exist
        raise HTTPException(404, "Project not found")
    return ProjectCtx(project, principal, membership.role)


def project_ctx(request: Request, principal: Principal = Depends(authenticate),
                session: Session = Depends(get_session)) -> ProjectCtx:
    """Resolve the project from the path (multi-user) or the default project (dev API-key mode)."""
    project_id = request.path_params.get("project_id")
    if project_id is None:
        if not principal.legacy:
            raise HTTPException(403, "Use /api/projects/{project_id}/... with identity-based tokens")
        project_id = DEFAULT_PROJECT_ID
    return load_project(session, principal, project_id)
