"""Structured, project-scoped tools the assistant may use to read authorised data.

Every tool receives the project id from the authenticated request context, never from
model output, so a prompt cannot widen access to other projects.
"""
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Variant
from app.services import samples as sample_service


class ToolError(ValueError):
    pass


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    fn: Callable[..., Any]


class Toolbox:
    def __init__(self, session: Session, project_id: str):
        self.session = session
        self.project_id = project_id
        self.tools = {t.name: t for t in (
            Tool("list_samples", "List samples in the authorised project.", {"type": "object", "properties": {}}, self._list),
            Tool("get_sample_qc", "Aggregate QC metrics for one sample.",
                 {"type": "object", "properties": {"sample_id": {"type": "string"}}, "required": ["sample_id"]}, self._qc),
            Tool("get_chromosome_summary", "Record counts per chromosome for one sample.",
                 {"type": "object", "properties": {"sample_id": {"type": "string"}}, "required": ["sample_id"]}, self._chromosomes),
            Tool("compare_samples", "Side-by-side aggregate metrics for several samples.",
                 {"type": "object", "properties": {"sample_ids": {"type": "array", "items": {"type": "string"}}},
                  "required": ["sample_ids"]}, self._compare),
            Tool("get_variant_sample", "Variant-level records (only used if variant sharing is approved).",
                 {"type": "object", "properties": {"sample_id": {"type": "string"}}, "required": ["sample_id"]}, self._variants),
        )}

    def specs(self) -> list[dict]:
        return [{"name": t.name, "description": t.description, "parameters": t.parameters}
                for t in self.tools.values()]

    def call(self, name: str, **kwargs):
        if name not in self.tools:
            raise ToolError("Unknown tool")
        return self.tools[name].fn(**kwargs)

    def sample(self, sample_id: str):
        sample = sample_service.get_sample(self.session, self.project_id, sample_id)
        if sample is None:
            raise ToolError("Sample not found in this project")
        return sample

    def _list(self):
        return [{"sample_id": s.id, "name": s.name, "assembly": s.assembly}
                for s in sample_service.list_samples(self.session, self.project_id)]

    def _qc(self, sample_id: str):
        s = self.sample(sample_id)
        keys = ("record_count", "pass_record_count", "unfiltered_record_count",
                "mean_variant_quality", "quality_observation_count", "mean_site_depth",
                "depth_observation_count")
        return {"sample_id": s.id, "name": s.name, "assembly": s.assembly,
                "metrics": {k: s.summary.get(k) for k in keys}}

    def _chromosomes(self, sample_id: str):
        s = self.sample(sample_id)
        return {"sample_id": s.id, "records_by_chromosome": s.summary["records_by_chromosome"]}

    def _compare(self, sample_ids: list[str]):
        return [self._qc(i) for i in sample_ids]

    def _variants(self, sample_id: str, limit: int = 10):
        s = self.sample(sample_id)
        rows = self.session.scalars(select(Variant).where(Variant.sample_id == s.id, Variant.is_pass.is_(True))
                                    .order_by(Variant.ordinal).limit(limit))
        return {"sample_id": s.id, "variants": [sample_service.variant_row(v) for v in rows]}
