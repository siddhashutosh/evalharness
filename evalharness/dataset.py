"""Golden-set loading and validation (YAML or JSONL)."""

from __future__ import annotations

import json
from pathlib import Path

import yaml
from pydantic import ValidationError

from evalharness.errors import DatasetError
from evalharness.log import get_logger
from evalharness.models import GoldenSet, TestCase

__all__ = ["DatasetError", "load_golden_set"]

_log = get_logger(__name__)


def load_golden_set(path: str) -> GoldenSet:
    """Load a golden set from a ``.yaml``/``.yml`` or ``.jsonl`` file."""
    p = Path(path)
    if not p.exists():
        raise DatasetError(f"golden set not found: {path}")

    suffix = p.suffix.lower()
    if suffix in {".yaml", ".yml"}:
        golden = _load_yaml(p)
    elif suffix == ".jsonl":
        golden = _load_jsonl(p)
    else:
        raise DatasetError(f"unsupported golden set format: {suffix} ({path})")

    _validate(golden, path)
    _log.debug("loaded golden set %r with %d cases from %s", golden.name, len(golden.cases), path)
    return golden


def _load_yaml(p: Path) -> GoldenSet:
    raw = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        raise DatasetError(f"golden set must be a mapping: {p}")
    raw.setdefault("name", p.stem)
    try:
        return GoldenSet(**raw)
    except ValidationError as exc:
        raise DatasetError(f"invalid golden set {p}:\n{exc}") from exc


def _load_jsonl(p: Path) -> GoldenSet:
    cases: list[TestCase] = []
    for lineno, line in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            cases.append(TestCase(**obj))
        except (json.JSONDecodeError, ValidationError, TypeError) as exc:
            raise DatasetError(f"invalid case on line {lineno} of {p}: {exc}") from exc
    return GoldenSet(name=p.stem, cases=cases)


def _validate(golden: GoldenSet, path: str) -> None:
    if not golden.cases:
        raise DatasetError(f"golden set {path} has no cases")
    seen: set[str] = set()
    for case in golden.cases:
        if not case.input:
            raise DatasetError(f"case {case.id!r} in {path} has an empty input")
        if case.id in seen:
            raise DatasetError(f"duplicate case id {case.id!r} in {path}")
        seen.add(case.id)
