"""Data model for evalharness.

Every entity that flows through the pipeline is a typed Pydantic model, so
golden sets, run results, and baselines validate and serialize for free. These
shapes are the single source of truth referenced by the LLD.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class TestCase(BaseModel):
    """One evaluation case: an input plus its expectations."""

    # Tell pytest this is a domain model, not a test class to collect.
    __test__ = False

    id: str
    input: str
    expected: str | None = None  # reference for exact/contains/regex/embedding
    rubric: str | None = None  # grading criteria for the LLM judge
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class GoldenSet(BaseModel):
    """A named, versioned collection of test cases (the ground truth)."""

    name: str
    version: str = "1"
    cases: list[TestCase]


class Usage(BaseModel):
    """Token usage for a single provider call."""

    input_tokens: int = 0
    output_tokens: int = 0

    def __add__(self, other: "Usage") -> "Usage":
        return Usage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
        )


class ProviderResponse(BaseModel):
    """The output of one LLM call, plus accounting metadata."""

    text: str
    model: str
    usage: Usage = Field(default_factory=Usage)
    cached: bool = False


class ScoreResult(BaseModel):
    """The verdict of one scorer on one output."""

    scorer: str
    score: float  # in [0, 1]
    passed: bool
    detail: str = ""


class CaseResult(BaseModel):
    """The full result for one test case: output + all scores + verdict."""

    case_id: str
    input: str
    output: str
    scores: list[ScoreResult] = Field(default_factory=list)
    passed: bool
    error: str | None = None
    usage: Usage = Field(default_factory=Usage)


class AggregateMetrics(BaseModel):
    """Suite-level rollup of a run."""

    total: int
    passed: int
    pass_rate: float
    mean_score_by_scorer: dict[str, float] = Field(default_factory=dict)
    input_tokens: int = 0
    output_tokens: int = 0
    est_cost_usd: float = 0.0


class RunResult(BaseModel):
    """The result of running a whole suite once."""

    suite: str
    target_model: str
    cases: list[CaseResult]
    metrics: AggregateMetrics
    created_at: str  # ISO 8601, injected by the caller (never at import time)


class Baseline(BaseModel):
    """A saved run treated as the reference point for regression detection."""

    run: RunResult
    git_sha: str | None = None


class GateReason(BaseModel):
    """One reason the gate failed."""

    kind: Literal["case_regression", "pass_rate_drop", "scorer_drop"]
    detail: str


class GateDecision(BaseModel):
    """The pass/fail outcome of a regression comparison."""

    model_config = ConfigDict(frozen=False)

    passed: bool
    reasons: list[GateReason] = Field(default_factory=list)
