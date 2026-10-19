from typing import Any, Literal

from pydantic import BaseModel, Field

Assembly = Literal["GRCh37", "GRCh38"]


class VariantOut(BaseModel):
    chromosome: str
    position: int
    reference: str
    alternates: list[str]
    quality: float | None
    filters: list[str]
    site_depth: int | None


class VariantPage(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[VariantOut]


class SampleOut(BaseModel):
    id: str
    project_id: str
    name: str
    assembly: str
    created_at: str
    sha256: str
    size_bytes: int
    source_format: str
    declared_reference: str | None
    reference_verification: str
    summary: dict[str, Any]


class JobOut(BaseModel):
    id: str
    job_type: str
    status: Literal["planned", "queued", "running", "completed", "failed"]
    sample_id: str | None
    created_at: str | None
    started_at: str | None
    finished_at: str | None
    error: str | None
    result: dict[str, Any] | None


class JobIn(BaseModel):
    job_type: Literal["variant_summary"]
    sample_id: str = Field(min_length=1, max_length=36)


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str
    role: str
    created_at: str
    sample_count: int


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field("", max_length=1000)


class MemberIn(BaseModel):
    email: str = Field(max_length=254)
    role: Literal["owner", "editor", "viewer"]


class RegisterIn(BaseModel):
    email: str = Field(max_length=254)
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=12, max_length=200)


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    sample_ids: list[str] | None = Field(None, max_length=5)
    conversation_id: str | None = Field(None, max_length=36)


class SummaryIn(BaseModel):
    sample_ids: list[str] | None = Field(None, max_length=5)
    conversation_id: str | None = Field(None, max_length=36)


class PurgeIn(BaseModel):
    older_than_days: int = Field(ge=1, le=36500)
