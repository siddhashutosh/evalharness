"""Provider interface.

A Provider is an adapter to an LLM backend. The interface is deliberately tiny
so a new backend is one class, and neither the runner nor the scorers need to
change. See ``docs/LLD.md`` §3.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from evalharness.errors import ProviderError
from evalharness.models import ProviderResponse, Usage

__all__ = ["Provider", "ProviderError"]


@runtime_checkable
class Provider(Protocol):
    """Adapter to an LLM backend."""

    name: str

    def complete(
        self,
        prompt: str,
        *,
        model: str,
        max_tokens: int = 1024,
        system: str | None = None,
        **opts: object,
    ) -> ProviderResponse:
        """Generate a completion for ``prompt`` and return output + usage."""

    def cost(self, model: str, usage: Usage) -> float:
        """Estimate the USD cost of ``usage`` on ``model``."""
