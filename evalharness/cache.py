"""Content-addressed response cache.

Keyed by (provider, model, prompt, system, params), so re-running an unchanged
suite hits the cache — free and reproducible. Changing the prompt or model
changes the key automatically, so the cache never masks a real change.
See ``docs/LLD.md`` §4.

A ``Cache`` Protocol is exported so the runner depends on the abstraction, not
this concrete on-disk implementation (Dependency Inversion).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Protocol, runtime_checkable

from evalharness.log import get_logger
from evalharness.models import ProviderResponse

_log = get_logger(__name__)

__all__ = ["Cache", "ResponseCache", "NullCache"]


@runtime_checkable
class Cache(Protocol):
    """Abstraction over a provider-response cache."""

    def key(
        self,
        provider: str,
        model: str,
        prompt: str,
        system: str | None,
        params: dict | None = None,
    ) -> str: ...

    def get(self, key: str) -> ProviderResponse | None: ...

    def put(self, key: str, resp: ProviderResponse) -> None: ...

    def clear(self) -> int: ...


def _hash_key(
    provider: str, model: str, prompt: str, system: str | None, params: dict | None
) -> str:
    payload = {
        "provider": provider,
        "model": model,
        "prompt": prompt,
        "system": system,
        "params": params or {},
    }
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class ResponseCache:
    """On-disk JSON cache: one file per key."""

    def __init__(self, root: str = ".evalcache", enabled: bool = True) -> None:
        self.root = Path(root)
        self.enabled = enabled
        if self.enabled:
            try:
                self.root.mkdir(parents=True, exist_ok=True)
            except OSError as exc:
                # A cache is an optimization; degrade gracefully rather than crash.
                _log.warning("could not create cache dir %s: %s (caching disabled)", self.root, exc)
                self.enabled = False

    def key(
        self,
        provider: str,
        model: str,
        prompt: str,
        system: str | None,
        params: dict | None = None,
    ) -> str:
        return _hash_key(provider, model, prompt, system, params)

    def _path(self, key: str) -> Path:
        return self.root / f"{key}.json"

    def get(self, key: str) -> ProviderResponse | None:
        if not self.enabled:
            return None
        path = self._path(key)
        if not path.exists():
            _log.debug("cache miss %s", key[:12])
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            resp = ProviderResponse(**data)
        except (json.JSONDecodeError, OSError, ValueError) as exc:
            _log.warning("ignoring corrupt cache entry %s: %s", key[:12], exc)
            return None
        _log.debug("cache hit %s", key[:12])
        # Mark as served from cache without mutating the stored copy.
        return resp.model_copy(update={"cached": True})

    def put(self, key: str, resp: ProviderResponse) -> None:
        if not self.enabled:
            return
        stored = resp.model_copy(update={"cached": False})
        try:
            self._path(key).write_text(stored.model_dump_json(indent=2), encoding="utf-8")
        except OSError as exc:
            # Never fail a run because the cache could not be written.
            _log.warning("could not write cache entry %s: %s", key[:12], exc)

    def clear(self) -> int:
        """Delete all cache entries; return the number removed."""
        if not self.root.exists():
            return 0
        removed = 0
        for f in self.root.glob("*.json"):
            try:
                f.unlink()
                removed += 1
            except OSError as exc:  # pragma: no cover
                _log.warning("could not delete cache entry %s: %s", f.name, exc)
        _log.debug("cleared %d cache entries", removed)
        return removed


class NullCache:
    """A cache that never stores anything (for ``--no-cache`` and tests)."""

    def key(
        self,
        provider: str,
        model: str,
        prompt: str,
        system: str | None,
        params: dict | None = None,
    ) -> str:
        return _hash_key(provider, model, prompt, system, params)

    def get(self, key: str) -> ProviderResponse | None:
        return None

    def put(self, key: str, resp: ProviderResponse) -> None:
        return None

    def clear(self) -> int:
        return 0
