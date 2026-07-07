"""Substring scorer.

Passes when the output contains the expected text. Supports ``all_of`` /
``any_of`` lists in the scorer options for multi-substring checks.
"""

from __future__ import annotations

from evalharness.models import ScoreResult, TestCase
from evalharness.scorers.base import ScorerError, normalize


class ContainsScorer:
    name = "contains"

    def __init__(
        self,
        threshold: float = 1.0,
        required: bool = False,
        *,
        casefold: bool = True,
        all_of: list[str] | None = None,
        any_of: list[str] | None = None,
    ) -> None:
        self.threshold = threshold
        self.required = required
        self.casefold = casefold
        self.all_of = all_of
        self.any_of = any_of

    def score(self, case: TestCase, output: str) -> ScoreResult:
        hay = normalize(output, casefold=self.casefold)

        if self.all_of:
            needles = self.all_of
            hits = [n for n in needles if normalize(n, casefold=self.casefold) in hay]
            s = len(hits) / len(needles)
            detail = f"matched {len(hits)}/{len(needles)} required substrings"
        elif self.any_of:
            needles = self.any_of
            hit = any(normalize(n, casefold=self.casefold) in hay for n in needles)
            s = 1.0 if hit else 0.0
            detail = "matched at least one" if hit else "matched none"
        else:
            if case.expected is None:
                raise ScorerError(
                    f"case {case.id!r} has no 'expected' for contains scorer"
                )
            hit = normalize(case.expected, casefold=self.casefold) in hay
            s = 1.0 if hit else 0.0
            detail = "contains expected" if hit else "missing expected"

        return ScoreResult(
            scorer=self.name, score=s, passed=s >= self.threshold, detail=detail
        )
