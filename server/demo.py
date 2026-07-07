"""Demo provider.

The dashboard must run end-to-end with no API key, so this builds a deterministic
``MockProvider`` seeded from a golden set: it "answers" each case correctly, and a
``quality`` knob (0..1) deterministically degrades a fraction of answers to
plausible-but-wrong distractors — which is exactly what you want to *demonstrate*
regression detection live in the UI.

This lives in the server layer, not the core harness: only a demo provider is
allowed to know the expected answers.
"""

from __future__ import annotations

import hashlib

from evalharness.models import GoldenSet, TestCase
from evalharness.providers.mock import MockProvider

_WRONG_FALLBACK = "I'm not certain about this one."


def _is_degraded(case: TestCase, quality: float) -> bool:
    """Deterministically decide whether this case gets a wrong answer.

    quality=1.0 -> never wrong; quality=0.0 -> always wrong. Stable per case id.
    """
    if quality >= 1.0:
        return False
    if quality <= 0.0:
        return True
    digest = hashlib.sha256(case.id.encode("utf-8")).hexdigest()
    bucket = int(digest[:8], 16) / 0xFFFFFFFF  # 0..1
    return bucket >= quality


def _answer_for(case: TestCase, quality: float) -> str:
    correct = case.expected or ""
    if not _is_degraded(case, quality):
        return correct
    # A wrong-but-plausible answer that does NOT contain the expected string.
    distractor = case.metadata.get("distractor")
    return str(distractor) if distractor else _WRONG_FALLBACK


def build_demo_provider(golden: GoldenSet, quality: float) -> MockProvider:
    """A MockProvider that answers the golden set at the given quality level."""
    responses: dict[str, str] = {c.input: _answer_for(c, quality) for c in golden.cases}
    by_input: dict[str, str] = {c.input: (c.expected or "") for c in golden.cases}

    def judge(prompt: str) -> str:
        question = _between(prompt, "QUESTION:\n", "\n\nCRITERIA")
        answer = _between(prompt, "ANSWER TO GRADE:\n", "\n\nRespond")
        expected = by_input.get(question.strip(), "")
        good = bool(expected) and expected.casefold() in answer.casefold()
        if good:
            return '{"score": 0.95, "pass": true, "reasoning": "Matches the expected answer."}'
        return '{"score": 0.15, "pass": false, "reasoning": "Does not satisfy the criteria."}'

    return MockProvider(responses=responses, judge_fn=judge, default=_WRONG_FALLBACK)


def _between(text: str, start: str, end: str) -> str:
    try:
        s = text.index(start) + len(start)
    except ValueError:
        return ""
    e = text.find(end, s)
    return text[s:] if e == -1 else text[s:e]
