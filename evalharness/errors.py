"""Centralized exception hierarchy.

Every error the harness raises deliberately derives from ``EvalHarnessError``,
so callers (and the CLI) can catch one base type to handle all expected
failures, while still being able to catch a specific subclass when they care
about the difference. Unexpected bugs remain plain exceptions and are not
swallowed.
"""

from __future__ import annotations


class EvalHarnessError(Exception):
    """Base class for all expected, user-facing errors in evalharness."""


class ConfigError(EvalHarnessError):
    """A suite configuration is missing or invalid."""


class DatasetError(EvalHarnessError):
    """A golden set is missing, malformed, or has duplicate ids."""


class ProviderError(EvalHarnessError):
    """A provider call failed after exhausting retries."""


class ScorerError(EvalHarnessError):
    """A scorer is misconfigured or received data it cannot grade."""


class CacheError(EvalHarnessError):
    """The response cache could not be read from or written to."""


class ReportError(EvalHarnessError):
    """A report could not be rendered or written."""
