"""Provider registry.

Resolve a provider by its config name. Implementations are imported lazily so
that, e.g., running offline tests never imports the Anthropic SDK.
"""

from __future__ import annotations

from evalharness.providers.base import Provider, ProviderError

__all__ = ["Provider", "ProviderError", "get_provider", "register_provider"]

# name -> zero/kwargs factory
_FACTORIES: dict[str, object] = {}


def register_provider(name: str, factory: object) -> None:
    """Register a provider factory under ``name``."""
    _FACTORIES[name] = factory


def get_provider(name: str, **kwargs: object) -> Provider:
    """Instantiate a provider by name."""
    if name in _FACTORIES:
        return _FACTORIES[name](**kwargs)  # type: ignore[operator]

    if name == "anthropic":
        from evalharness.providers.anthropic import AnthropicProvider

        return AnthropicProvider(**kwargs)
    if name == "openai":
        from evalharness.providers.openai import OpenAIProvider

        return OpenAIProvider(**kwargs)
    if name == "mock":
        from evalharness.providers.mock import MockProvider

        return MockProvider(**kwargs)

    raise ProviderError(f"unknown provider: {name!r}")
