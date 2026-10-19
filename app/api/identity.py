"""Identity-based authentication, projects, memberships, audit and retention."""
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import Principal, ProjectCtx, authenticate, get_session, load_project
from app.auth.security import issue_token, verify_password
from app.db.models import AuditEvent, Project, ProjectMembership, Sample, User
from app.db.session import DEFAULT_PROJECT_ID
from app.schemas.api import LoginIn, MemberIn, ProjectIn, ProjectOut, PurgeIn, RegisterIn, TokenOut
from app.services import audit
from app.services import samples as svc
from app.services.users import UserError, create_user

router = APIRouter()
_DUMMY_HASH = "scrypt$16384$8$1$" + "00" * 16 + "$" + "00" * 64


def _require_multi_user(request: Request):
    if not request.app.state.settings.multi_user_enabled:
        raise HTTPException(503, "Identity-based authentication is not configured (set AUTH_SECRET_KEY)")
    return request.app.state.settings


@router.post("/api/auth/register", status_code=201, tags=["auth"])
def register(request: Request, body: RegisterIn, session: Session = Depends(get_session)):
    settings = _require_multi_user(request)
    if not settings.registration_open:
        raise HTTPException(403, "Registration is closed; create users with python -m app.auth.cli")
    try:
        user = create_user(session, body.email, body.display_name, body.password)
    except UserError as exc:
        raise HTTPException(422, str(exc)) from exc
    audit.record(session, user.id, "user.register")
    session.commit()
    return {"id": user.id, "email": user.email, "display_name": user.display_name}


@router.post("/api/auth/login", response_model=TokenOut, tags=["auth"])
def login(request: Request, body: LoginIn, session: Session = Depends(get_session)):
    settings = _require_multi_user(request)
    user = session.scalar(select(User).where(User.email == body.email.strip().lower()))
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not (user and ok and user.is_active):
        audit.record(session, "anonymous", "auth.login", outcome="denied")
        session.commit()
        raise HTTPException(401, "Invalid credentials")
    audit.record(session, user.id, "auth.login")
    session.commit()
    ttl = settings.auth_token_ttl_minutes
    return {"access_token": issue_token(user.id, settings.auth_secret_key, ttl),
            "token_type": "bearer", "expires_in": ttl * 60}


@router.get("/api/auth/me", tags=["auth"])
def me(principal: Principal = Depends(authenticate)):
    if principal.legacy:
        return {"id": None, "mode": "dev-api-key-compatibility"}
    return {"id": principal.user.id, "email": principal.user.email,
            "display_name": principal.user.display_name, "mode": "identity"}


def _project_out(session: Session, project: Project, role: str) -> dict:
    count = session.scalar(select(func.count()).select_from(Sample).where(Sample.project_id == project.id))
    return {"id": project.id, "name": project.name, "description": project.description, "role": role,
            "created_at": project.created_at.isoformat(), "sample_count": count}


@router.get("/api/projects", response_model=list[ProjectOut], tags=["projects"])
def list_projects(principal: Principal = Depends(authenticate), session: Session = Depends(get_session)):
    if principal.legacy:
        return [_project_out(session, session.get(Project, DEFAULT_PROJECT_ID), "owner")]
    rows = session.execute(select(Project, ProjectMembership.role)
                           .join(ProjectMembership, ProjectMembership.project_id == Project.id)
                           .where(ProjectMembership.user_id == principal.user.id)
                           .order_by(Project.created_at))
    return [_project_out(session, p, role) for p, role in rows]


@router.post("/api/projects", status_code=201, response_model=ProjectOut, tags=["projects"])
def create_project(body: ProjectIn, principal: Principal = Depends(authenticate),
                   session: Session = Depends(get_session)):
    if principal.legacy:
        raise HTTPException(403, "Project creation requires identity-based authentication")
    project = Project(name=body.name, description=body.description)
    session.add(project)
    session.flush()
    session.add(ProjectMembership(project_id=project.id, user_id=principal.user.id, role="owner"))
    audit.record(session, principal.actor, "project.create", project.id, "project", project.id)
    session.commit()
    return _project_out(session, project, "owner")


def _owner_ctx(project_id: str, principal: Principal, session: Session) -> ProjectCtx:
    ctx = load_project(session, principal, project_id)
    ctx.require("owner")
    return ctx


@router.post("/api/projects/{project_id}/members", status_code=201, tags=["projects"])
def add_member(project_id: str, body: MemberIn, principal: Principal = Depends(authenticate),
               session: Session = Depends(get_session)):
    if principal.legacy:
        raise HTTPException(403, "Membership management requires identity-based authentication")
    ctx = _owner_ctx(project_id, principal, session)
    user = session.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None:
        raise HTTPException(404, "User not found")
    membership = session.scalar(select(ProjectMembership).where(
        ProjectMembership.project_id == ctx.project.id, ProjectMembership.user_id == user.id))
    if membership:
        membership.role = body.role
    else:
        session.add(ProjectMembership(project_id=ctx.project.id, user_id=user.id, role=body.role))
    audit.record(session, principal.actor, "project.member.set", ctx.project.id, "user", user.id,
                 detail={"role": body.role})
    session.commit()
    return {"user_id": user.id, "role": body.role}


@router.delete("/api/projects/{project_id}", status_code=204, tags=["projects"])
def delete_project(project_id: str, principal: Principal = Depends(authenticate),
                   session: Session = Depends(get_session)):
    ctx = _owner_ctx(project_id, principal, session)
    if ctx.project.is_default:
        raise HTTPException(409, "The default project cannot be deleted")
    for sample in svc.list_samples(session, ctx.project.id):
        svc.delete_sample(session, sample)
    audit.record(session, principal.actor, "project.delete", ctx.project.id, "project", ctx.project.id)
    session.delete(ctx.project)
    session.commit()


@router.get("/api/projects/{project_id}/audit", tags=["projects"])
def audit_log(project_id: str, principal: Principal = Depends(authenticate),
              session: Session = Depends(get_session)):
    ctx = _owner_ctx(project_id, principal, session)
    rows = session.scalars(select(AuditEvent).where(AuditEvent.project_id == ctx.project.id)
                           .order_by(AuditEvent.id.desc()).limit(200))
    return [{"id": e.id, "created_at": e.created_at.isoformat(), "actor": e.actor, "action": e.action,
             "target_type": e.target_type, "target_id": e.target_id, "outcome": e.outcome} for e in rows]


@router.post("/api/projects/{project_id}/retention/purge", tags=["projects"])
def purge(project_id: str, body: PurgeIn, principal: Principal = Depends(authenticate),
          session: Session = Depends(get_session)):
    ctx = _owner_ctx(project_id, principal, session)
    cutoff = datetime.now(UTC) - timedelta(days=body.older_than_days)
    old = session.scalars(select(Sample).where(Sample.project_id == ctx.project.id, Sample.created_at < cutoff)).all()
    for sample in old:
        svc.delete_sample(session, sample)
    audit.record(session, principal.actor, "retention.purge", ctx.project.id,
                 detail={"samples_deleted": len(old), "older_than_days": body.older_than_days})
    session.commit()
    return {"samples_deleted": len(old)}
