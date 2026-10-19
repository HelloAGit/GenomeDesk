"""Fail if the current API removes or tightens anything in the frozen v0.1.0 contract.

Usage: python scripts/check_openapi_compat.py [baseline.json]
Checks: every baseline path+method still exists, still documents its success status
codes, and no new *required* parameters were added to baseline operations.
"""
import json
import sys
from pathlib import Path

from app.main import create_app

BASELINE = Path(__file__).parents[1] / "tests" / "contract" / "openapi-v0.1.0.json"
METHODS = {"get", "post", "put", "patch", "delete"}


def required_params(operation: dict) -> set[tuple[str, str]]:
    return {(p["in"], p["name"]) for p in operation.get("parameters", []) if p.get("required")}


def required_form_fields(spec: dict, operation: dict) -> set[str]:
    body = operation.get("requestBody", {}).get("content", {})
    for media in body.values():
        schema = media.get("schema", {})
        if "$ref" in schema:
            schema = spec["components"]["schemas"][schema["$ref"].split("/")[-1]]
        return set(schema.get("required", []))
    return set()


def compare(old: dict, new: dict) -> list[str]:
    problems = []
    for path, item in old["paths"].items():
        for method, op in item.items():
            if method not in METHODS:
                continue
            new_op = new["paths"].get(path, {}).get(method)
            if new_op is None:
                problems.append(f"removed: {method.upper()} {path}")
                continue
            missing = {c for c in op.get("responses", {}) if c.startswith("2")} - set(new_op.get("responses", {}))
            if missing:
                problems.append(f"{method.upper()} {path}: success responses removed {sorted(missing)}")
            added = required_params(new_op) - required_params(op)
            if added:
                problems.append(f"{method.upper()} {path}: new required parameters {sorted(added)}")
            extra = required_form_fields(new, new_op) - required_form_fields(old, op)
            if extra:
                problems.append(f"{method.upper()} {path}: new required body fields {sorted(extra)}")
    return problems


def main() -> int:
    baseline = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else BASELINE).read_text())
    problems = compare(baseline, create_app().openapi())
    for problem in problems:
        print("INCOMPATIBLE", problem)
    print("OpenAPI contract compatible" if not problems else f"{len(problems)} incompatibilities")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
