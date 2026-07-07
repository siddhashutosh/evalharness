"""Logging configuration for evalharness.

A single namespaced logger tree under ``evalharness``. The library never
configures handlers on import (that is the application's job); ``configure()``
is called by the CLI. When ``rich`` is available its handler is used for pretty,
level-coloured output, otherwise a plain stream handler is used.
"""

from __future__ import annotations

import logging

_ROOT = "evalharness"
_configured = False


def get_logger(name: str) -> logging.Logger:
    """Return a child logger under the ``evalharness`` namespace.

    Pass ``__name__``; the leading package segment is normalised so all loggers
    share the same root and can be configured together.
    """
    if name == "__main__" or not name.startswith(_ROOT):
        name = f"{_ROOT}.{name.rsplit('.', 1)[-1]}"
    logger = logging.getLogger(name)
    # Ensure the namespace root has a NullHandler so library use in another app
    # never emits "No handlers could be found" warnings. Attach once.
    root = logging.getLogger(_ROOT)
    if not any(isinstance(h, logging.NullHandler) for h in root.handlers):
        root.addHandler(logging.NullHandler())
    return logger


def configure(level: str = "warning") -> None:
    """Attach a handler to the ``evalharness`` root logger at ``level``.

    Idempotent: repeated calls only adjust the level. Called by the CLI.
    """
    global _configured
    root = logging.getLogger(_ROOT)
    root.setLevel(_coerce_level(level))
    if _configured:
        return

    handler: logging.Handler
    try:
        from rich.logging import RichHandler

        handler = RichHandler(rich_tracebacks=True, show_path=False, show_time=False)
        fmt = logging.Formatter("%(message)s")
    except Exception:  # pragma: no cover - rich always present here
        handler = logging.StreamHandler()
        fmt = logging.Formatter("%(levelname)s %(name)s: %(message)s")

    handler.setFormatter(fmt)
    root.addHandler(handler)
    # Intentionally leave propagate=True: libraries should not disable
    # propagation. In the CLI the global root logger has no handler, so there is
    # no duplicate output; apps that configure their own root still see our logs.
    _configured = True


def _coerce_level(level: str | int) -> int:
    if isinstance(level, int):
        return level
    return getattr(logging, level.upper(), logging.WARNING)
