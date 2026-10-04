from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    backend_api_key: str = ""
    cors_origins: list[str] = ["http://localhost:3000"]
    data_dir: str = "./data"
    max_upload_bytes: int = 10 * 1024 * 1024
    max_records: int = 50000
    nebius_api_key: str = ""
    nebius_model: str = ""
