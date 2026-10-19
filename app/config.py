from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    backend_api_key: str = ""
    # Dev compatibility mode: single shared X-API-Key mapped to one default project.
    legacy_api_key_enabled: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]
    data_dir: str = "./data"
    # Empty => SQLite file inside data_dir. Use postgresql+psycopg://... for PostgreSQL.
    database_url: str = ""
    max_upload_bytes: int = 10 * 1024 * 1024
    max_decompressed_bytes: int = 100 * 1024 * 1024
    max_records: int = 50000
    # Identity-based auth (multi-user). Disabled unless AUTH_SECRET_KEY has >= 32 chars.
    auth_secret_key: str = ""
    auth_token_ttl_minutes: int = 60
    registration_open: bool = False
    # Per-client request limits per minute; 0 disables.
    rate_limit_per_minute: int = 240
    auth_rate_limit_per_minute: int = 10
    # Retention; 0 keeps data until explicitly deleted.
    sample_retention_days: int = 0
    audit_retention_days: int = 0
    nebius_api_key: str = ""
    nebius_model: str = ""
    # Variant-level data is never sent to an external AI provider unless approved here.
    ai_share_variant_level: bool = False

    def resolved_database_url(self) -> str:
        return self.database_url or f"sqlite:///{self.data_dir}/genomedesk_v2.sqlite3"

    @property
    def multi_user_enabled(self) -> bool:
        return len(self.auth_secret_key) >= 32
