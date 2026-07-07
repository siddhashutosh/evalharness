"""evalharness — a reusable LLM evaluation harness.

Golden test sets, LLM-as-judge scoring, regression detection against a baseline,
and a CI quality gate that fails the build when quality drops.

See ``docs/`` for the SRS, HLD, LLD, and Design Document.
"""

from evalharness.errors import (
    CacheError,
    ConfigError,
    DatasetError,
    EvalHarnessError,
    ProviderError,
    ReportError,
    ScorerError,
)
from evalharness.log import configure as configure_logging
from evalharness.log import get_logger
from evalharness.models import (
    AggregateMetrics,
    Baseline,
    CaseResult,
    GateDecision,
    GateReason,
    GoldenSet,
    ProviderResponse,
    RunResult,
    ScoreResult,
    TestCase,
    Usage,
)

__version__ = "1.0.0"

__all__ = [
    "__version__",
    # data model
    "TestCase",
    "GoldenSet",
    "Usage",
    "ProviderResponse",
    "ScoreResult",
    "CaseResult",
    "AggregateMetrics",
    "RunResult",
    "Baseline",
    "GateReason",
    "GateDecision",
    # errors
    "EvalHarnessError",
    "ConfigError",
    "DatasetError",
    "ProviderError",
    "ScorerError",
    "CacheError",
    "ReportError",
    # logging
    "get_logger",
    "configure_logging",
]
