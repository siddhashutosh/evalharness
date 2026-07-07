"""LLM-as-judge scorer.

A strong model grades the output against the case rubric and returns a
*structured* verdict ``{score, pass, reasoning}``. Routing the judge call
through the same ``Provider`` (rather than a raw SDK client) keeps it
provider-agnostic and — importantly — cacheable, so a given
``(judge_model, rubric, output)`` grades identically on every re-run. The
verdict is validated against a Pydantic schema, removing string-parsing
flakiness. See ``docs/DESIGN.md`` §4.1.
"""

from __future__ import annotations

import json

from pydantic import BaseModel, Field, ValidationError

from evalharness.models import ScoreResult, TestCase
from evalharness.providers.base import Provider
from evalharness.providers.mock import JUDGE_MARKER
from evalharness.scorers.base import ScorerError

_JUDGE_SYSTEM = (
    "You are a strict, fair evaluator. Grade the ANSWER against the CRITERIA. "
    "Return a calibrated score in [0,1], a boolean pass, and one sentence of "
    "reasoning. Do not reward answers that ignore the criteria."
)

_JUDGE_TEMPLATE = (
    JUDGE_MARKER
    + "\n"
    + "You are grading an assistant's answer.\n\n"
    "QUESTION:\n{input}\n\n"
    "CRITERIA (what a good answer must satisfy):\n{criteria}\n\n"
    "ANSWER TO GRADE:\n{output}\n\n"
    "Respond with ONLY a JSON object, no prose, of exactly this shape:\n"
    '{{"score": <float 0..1>, "pass": <true|false>, "reasoning": "<one sentence>"}}'
)


class JudgeVerdict(BaseModel):
    """Structured verdict returned by the judge model."""

    score: float
    pass_: bool = Field(alias="pass")
    reasoning: str = ""


class LLMJudgeScorer:
    name = "llm_judge"

    def __init__(
        self,
        threshold: float = 0.6,
        required: bool = False,
        *,
        provider: Provider,
        judge_model: str = "claude-opus-4-8",
        max_tokens: int = 512,
    ) -> None:
        self.threshold = threshold
        self.required = required
        self._provider = provider
        self._judge_model = judge_model
        self._max_tokens = max_tokens

    def score(self, case: TestCase, output: str) -> ScoreResult:
        criteria = case.rubric or case.expected
        if not criteria:
            raise ScorerError(
                f"case {case.id!r}: llm_judge needs a 'rubric' (or 'expected') to grade against"
            )
        prompt = _JUDGE_TEMPLATE.format(input=case.input, criteria=criteria, output=output)
        resp = self._provider.complete(
            prompt,
            model=self._judge_model,
            max_tokens=self._max_tokens,
            system=_JUDGE_SYSTEM,
        )
        verdict = self._parse(resp.text)
        s = max(0.0, min(1.0, verdict.score))
        return ScoreResult(
            scorer=self.name,
            score=s,
            passed=s >= self.threshold,
            detail=verdict.reasoning.strip()[:300],
        )

    @staticmethod
    def _parse(text: str) -> JudgeVerdict:
        raw = _extract_json(text)
        try:
            data = json.loads(raw)
            return JudgeVerdict(**data)
        except (json.JSONDecodeError, ValidationError, TypeError) as exc:
            raise ScorerError(
                f"judge returned unparseable verdict: {text[:200]!r}"
            ) from exc


def _extract_json(text: str) -> str:
    """Pull the first {...} object out of the model's response text."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return text
    return text[start : end + 1]
