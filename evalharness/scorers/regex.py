"""Regex scorer: 1.0 iff the pattern is found in the output."""

from __future__ import annotations

import re

from evalharness.models import ScoreResult, TestCase
from evalharness.scorers.base import ScorerError


class RegexScorer:
    name = "regex"

    def __init__(
        self,
        threshold: float = 1.0,
        required: bool = False,
        *,
        pattern: str | None = None,
        flags: int = 0,
    ) -> None:
        self.threshold = threshold
        self.required = required
        # Explicit pattern from config takes precedence; else use case.expected.
        self._pattern = pattern
        self._flags = flags

    def score(self, case: TestCase, output: str) -> ScoreResult:
        pattern = self._pattern if self._pattern is not None else case.expected
        if pattern is None:
            raise ScorerError(
                f"case {case.id!r}: regex scorer needs a 'pattern' option or an 'expected' value"
            )
        try:
            match = re.search(pattern, output, self._flags) is not None
        except re.error as exc:
            raise ScorerError(f"invalid regex {pattern!r}: {exc}") from exc
        s = 1.0 if match else 0.0
        return ScoreResult(
            scorer=self.name,
            score=s,
            passed=s >= self.threshold,
            detail=f"pattern {'matched' if match else 'not matched'}: {pattern!r}",
        )
