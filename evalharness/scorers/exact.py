"""Exact-match scorer: 1.0 iff normalized output == normalized expected."""

from __future__ import annotations

from evalharness.models import ScoreResult, TestCase
from evalharness.scorers.base import ScorerError, normalize


class ExactScorer:
    name = "exact"

    def __init__(self, threshold: float = 1.0, required: bool = False, *, casefold: bool = True) -> None:
        self.threshold = threshold
        self.required = required
        self.casefold = casefold

    def score(self, case: TestCase, output: str) -> ScoreResult:
        if case.expected is None:
            raise ScorerError(f"case {case.id!r} has no 'expected' for exact scorer")
        match = normalize(output, casefold=self.casefold) == normalize(
            case.expected, casefold=self.casefold
        )
        s = 1.0 if match else 0.0
        return ScoreResult(
            scorer=self.name,
            score=s,
            passed=s >= self.threshold,
            detail="exact match" if match else "no exact match",
        )
