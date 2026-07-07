"""Suite configuration: what to run, how to score it, and when to fail the gate."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, ValidationError, field_validator

from evalharness.errors import ConfigError
from evalharness.log import get_logger

__all__ = ["ConfigError", "ScorerSpec", "Thresholds", "SuiteConfig", "load_suite"]

_log = get_logger(__name__)


class ScorerSpec(BaseModel):
    """One scorer entry in a suite config."""

    type: str
    threshold: float = 0.5
    required: bool = False
    options: dict[str, Any] = Field(default_factory=dict)


class Thresholds(BaseModel):
    """Regression tolerances applied by the gate."""

    # A pass-rate drop strictly greater than this fails the gate.
    pass_rate_drop: float = 0.0
    # A per-scorer mean-score drop strictly greater than this fails the gate.
    scorer_mean_drop: float = 0.05


class SuiteConfig(BaseModel):
    """The full description of an evaluation suite."""

    name: str
    golden_set: str
    provider: str = "anthropic"
    target_model: str = "claude-opus-4-8"
    judge_model: str = "claude-opus-4-8"
    max_tokens: int = 512
    system: str | None = None
    prompt_template: str = "{input}"
    scorers: list[ScorerSpec]
    thresholds: Thresholds = Field(default_factory=Thresholds)
    concurrency: int = 4

    # Resolved absolute path to the golden set (set during load).
    base_dir: str = "."

    @field_validator("prompt_template")
    @classmethod
    def _must_have_input_placeholder(cls, v: str) -> str:
        if "{input}" not in v:
            raise ValueError("prompt_template must contain the '{input}' placeholder")
        return v

    @field_validator("scorers")
    @classmethod
    def _must_have_scorers(cls, v: list[ScorerSpec]) -> list[ScorerSpec]:
        if not v:
            raise ValueError("at least one scorer is required")
        return v

    def golden_set_path(self) -> str:
        """Resolve the golden set path relative to the config file's directory."""
        p = Path(self.golden_set)
        if p.is_absolute():
            return str(p)
        return str(Path(self.base_dir) / p)


def load_suite(path: str) -> SuiteConfig:
    """Load and validate a suite config from a YAML file."""
    cfg_path = Path(path)
    if not cfg_path.exists():
        raise ConfigError(f"suite config not found: {path}")
    try:
        raw = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:  # pragma: no cover - passthrough
        raise ConfigError(f"invalid YAML in {path}: {exc}") from exc
    if not isinstance(raw, dict):
        raise ConfigError(f"suite config must be a mapping: {path}")
    raw.setdefault("base_dir", str(cfg_path.resolve().parent))
    try:
        config = SuiteConfig(**raw)
    except ValidationError as exc:
        raise ConfigError(f"invalid suite config {path}:\n{exc}") from exc
    _log.debug(
        "loaded suite %r: provider=%s target=%s scorers=%d",
        config.name,
        config.provider,
        config.target_model,
        len(config.scorers),
    )
    return config
