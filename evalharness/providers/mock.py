"""Mock provider for offline tests and examples.

Deterministic: maps an input to a canned output via a dict or a callable, so the
whole pipeline (runner, scorers, gate) can be exercised with no API key and no
network. Judge-scorer calls are distinguished by a marker in the prompt.
"""

from __future__ import annotations

from collections.abc import Callable

from evalharness.models import ProviderResponse, Usage

# Marker the llm_judge scorer places in its prompt so the mock can special-case it.
JUDGE_MARKER = "[[evalharness-judge]]"


class MockProvider:
    """Provider that returns deterministic canned responses."""

    name = "mock"

    def __init__(
        self,
        responses: dict[str, str] | None = None,
        *,
        default: str = "",
        judge_fn: Callable[[str], str] | None = None,
        fallback: Callable[[str], str] | None = None,
    ) -> None:
        self._responses = responses or {}
        self._default = default
        # Given the judge prompt, return the verdict JSON text.
        self._judge_fn = judge_fn
        # Given the prompt, compute an output when not in the responses dict.
        self._fallback = fallback

    def complete(
        self,
        prompt: str,
        *,
        model: str,
        max_tokens: int = 1024,
        system: str | None = None,
        **opts: object,
    ) -> ProviderResponse:
        if JUDGE_MARKER in prompt and self._judge_fn is not None:
            text = self._judge_fn(prompt)
        elif prompt in self._responses:
            text = self._responses[prompt]
        elif self._fallback is not None:
            text = self._fallback(prompt)
        else:
            text = self._default
        return ProviderResponse(text=text, model=model, usage=Usage(), cached=False)

    def cost(self, model: str, usage: Usage) -> float:  # noqa: ARG002
        return 0.0
