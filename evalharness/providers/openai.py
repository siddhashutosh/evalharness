"""OpenAI provider — a drop-in stub proving the interface is backend-agnostic.

Implemented as a thin adapter so that swapping ``provider: openai`` in a suite
config Just Works once the ``openai`` package and a key are present. Not the
focus of this project; the Anthropic provider is the reference implementation.
"""

from __future__ import annotations

from evalharness.models import ProviderResponse, Usage
from evalharness.providers.base import ProviderError

# USD per 1M tokens (input, output); indicative placeholders.
_PRICES: dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
}
_DEFAULT_PRICE = (2.50, 10.00)


class OpenAIProvider:
    """Provider backed by the OpenAI SDK (chat completions)."""

    name = "openai"

    def __init__(self, *, client: object | None = None) -> None:
        if client is not None:
            self._client = client
        else:
            try:
                import openai
            except ImportError as exc:  # pragma: no cover
                raise ProviderError(
                    "the 'openai' package is required for the OpenAI provider"
                ) from exc
            self._client = openai.OpenAI()

    def complete(
        self,
        prompt: str,
        *,
        model: str,
        max_tokens: int = 1024,
        system: str | None = None,
        **opts: object,
    ) -> ProviderResponse:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        resp = self._client.chat.completions.create(
            model=model, messages=messages, max_tokens=max_tokens
        )
        text = resp.choices[0].message.content or ""
        usage_obj = getattr(resp, "usage", None)
        usage = Usage(
            input_tokens=getattr(usage_obj, "prompt_tokens", 0) or 0,
            output_tokens=getattr(usage_obj, "completion_tokens", 0) or 0,
        )
        return ProviderResponse(text=text, model=model, usage=usage, cached=False)

    def cost(self, model: str, usage: Usage) -> float:
        in_price, out_price = _PRICES.get(model, _DEFAULT_PRICE)
        return (
            usage.input_tokens / 1_000_000 * in_price
            + usage.output_tokens / 1_000_000 * out_price
        )
