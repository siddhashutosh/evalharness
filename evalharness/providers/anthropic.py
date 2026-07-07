"""Anthropic provider.

Wraps the official Anthropic SDK. Follows current SDK guidance: adaptive
thinking (never ``budget_tokens``), streaming for large ``max_tokens`` to avoid
HTTP timeouts, and reading ``response.usage`` for cost accounting. The API key
is resolved by the SDK from the environment / ``ant`` auth profile — never
passed in or logged here.
"""

from __future__ import annotations

import time

from evalharness.errors import ProviderError
from evalharness.log import get_logger
from evalharness.models import ProviderResponse, Usage

_log = get_logger(__name__)

# Per-model price table, USD per 1M tokens (input, output). Used only for
# reporting an estimated cost; unknown models fall back to a conservative rate.
_PRICES: dict[str, tuple[float, float]] = {
    "claude-opus-4-8": (5.00, 25.00),
    "claude-opus-4-7": (5.00, 25.00),
    "claude-sonnet-5": (3.00, 15.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "claude-fable-5": (10.00, 50.00),
}
_DEFAULT_PRICE = (5.00, 25.00)

# Above this many max_tokens, use streaming to avoid SDK HTTP timeouts.
_STREAM_THRESHOLD = 8000


class AnthropicProvider:
    """Provider backed by ``anthropic.Anthropic``."""

    name = "anthropic"

    def __init__(self, *, max_retries: int = 3, client: object | None = None) -> None:
        self.max_retries = max_retries
        if client is not None:
            self._client = client
        else:
            try:
                import anthropic
            except ImportError as exc:  # pragma: no cover
                raise ProviderError(
                    "the 'anthropic' package is required for the Anthropic provider; "
                    "install with: pip install 'evalharness[anthropic]'"
                ) from exc
            # Key resolved by the SDK from env / ant auth profile.
            self._client = anthropic.Anthropic()

    def complete(
        self,
        prompt: str,
        *,
        model: str,
        max_tokens: int = 1024,
        system: str | None = None,
        **opts: object,
    ) -> ProviderResponse:
        messages = [{"role": "user", "content": prompt}]
        kwargs: dict[str, object] = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
            # Adaptive thinking is the recommended mode on current models.
            "thinking": {"type": "adaptive"},
        }
        if system:
            kwargs["system"] = system

        last_exc: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                message = self._create(kwargs, max_tokens)
                return self._to_response(message, model)
            except Exception as exc:  # bounded retry on transient failures
                last_exc = exc
                if not self._is_transient(exc) or attempt == self.max_retries - 1:
                    break
                backoff = min(2**attempt, 8)
                _log.warning(
                    "transient error from Anthropic (%s), retry %d/%d in %ds",
                    type(exc).__name__,
                    attempt + 1,
                    self.max_retries,
                    backoff,
                )
                time.sleep(backoff)
        raise ProviderError(f"Anthropic call failed for model {model}: {last_exc}") from last_exc

    def _create(self, kwargs: dict[str, object], max_tokens: int) -> object:
        if max_tokens > _STREAM_THRESHOLD:
            with self._client.messages.stream(**kwargs) as stream:
                return stream.get_final_message()
        return self._client.messages.create(**kwargs)

    @staticmethod
    def _to_response(message: object, model: str) -> ProviderResponse:
        text = "".join(
            getattr(block, "text", "")
            for block in getattr(message, "content", [])
            if getattr(block, "type", None) == "text"
        )
        usage_obj = getattr(message, "usage", None)
        usage = Usage(
            input_tokens=getattr(usage_obj, "input_tokens", 0) or 0,
            output_tokens=getattr(usage_obj, "output_tokens", 0) or 0,
        )
        return ProviderResponse(
            text=text, model=getattr(message, "model", model), usage=usage, cached=False
        )

    @staticmethod
    def _is_transient(exc: Exception) -> bool:
        name = type(exc).__name__
        return name in {
            "RateLimitError",
            "APIConnectionError",
            "APITimeoutError",
            "InternalServerError",
            "OverloadedError",
        }

    def cost(self, model: str, usage: Usage) -> float:
        in_price, out_price = _PRICES.get(model, _DEFAULT_PRICE)
        return (
            usage.input_tokens / 1_000_000 * in_price
            + usage.output_tokens / 1_000_000 * out_price
        )
