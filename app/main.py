import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.api import identity, scoped
from app.api.deps import Principal, authenticate
from app.api.ratelimit import RateLimitMiddleware
from app.config import Settings
from app.db.legacy import import_legacy_store
from app.db.session import init_db, make_engine, make_session_factory

VERSION = "2.0.0"
logger = logging.getLogger("genomedesk")


def _unique_id(route: APIRoute) -> str:
    path = route.path_format.strip("/").replace("/", "_").replace("{", "").replace("}", "")
    return f"{route.name}_{path}_{sorted(route.methods)[0].lower()}"


def create_app(settings=None):
    settings = settings or Settings()
    app = FastAPI(title="GenomeDesk Backend", version=VERSION, generate_unique_id_function=_unique_id)
    engine = make_engine(settings.resolved_database_url())
    factory = make_session_factory(engine)
    init_db(engine, factory)
    with factory() as session:
        import_legacy_store(session, settings.data_dir)
    app.state.settings = settings
    app.state.session_factory = factory
    app.state.engine = engine
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins,
        allow_credentials=False, allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "X-API-Key", "Authorization"],
    )
    app.add_middleware(RateLimitMiddleware, general=settings.rate_limit_per_minute,
                       auth=settings.auth_rate_limit_per_minute)

    @app.get("/health")
    def health():
        return {"status": "ok", "version": VERSION}

    @app.get("/api/capabilities")
    def capabilities(principal: Principal = Depends(authenticate)):
        return {"vcf_import": True, "vcf_gz_import": True, "fastq_processing": False,
                "annotation": False,
                "authentication": "single-workspace-server-key" if principal.legacy else "identity",
                "auth_modes": ["identity"] * settings.multi_user_enabled
                              + ["dev-api-key-compatibility"] * (settings.legacy_api_key_enabled and bool(settings.backend_api_key)),
                "ai_configured": bool(settings.nebius_api_key and settings.nebius_model),
                "variant_level_ai_sharing": settings.ai_share_variant_level,
                "max_upload_bytes": settings.max_upload_bytes,
                "max_decompressed_bytes": settings.max_decompressed_bytes,
                "max_records": settings.max_records}

    app.include_router(identity.router)
    # Dev API-key compatibility routes (default project) and identity-based project routes.
    app.include_router(scoped.router, prefix="/api")
    app.include_router(scoped.router, prefix="/api/projects/{project_id}", tags=["projects"])
    return app


app = create_app()
