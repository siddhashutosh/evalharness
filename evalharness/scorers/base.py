"""Scorer interface and shared helpers.

A Scorer maps ``(case, output) -> ScoreResult``. Keeping the interface to one
method means a new metric is one small class, registered by name, with no
changes to the runner. See ``docs/LLD.md`` §5.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from evalharness.errors import ScorerError
from evalharness.models import ScoreResult, TestCase

__all__ = ["Scorer", "ScorerError", "normalize"]


@runtime_checkable
class Scorer(Protocol):
    """Maps an output to a score in [0, 1] plus a pass/fail verdict."""

    name: str
    threshold: float
    required: bool

    def score(self, case: TestCase, output: str) -> ScoreResult: ...


def normalize(text: str, *, casefold: bool = True) -> str:
    """Whitespace-strip and optionally casefold for lenient text comparison."""
    text = text.strip()
    return text.casefold() if casefold else text
