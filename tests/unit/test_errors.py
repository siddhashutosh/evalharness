"""All expected errors share one base, so callers can catch broadly or narrowly."""

import pytest

from evalharness.config import ConfigError
from evalharness.dataset import DatasetError
from evalharness.errors import EvalHarnessError
from evalharness.providers.base import ProviderError
from evalharness.scorers.base import ScorerError


@pytest.mark.parametrize("exc", [ConfigError, DatasetError, ProviderError, ScorerError])
def test_all_errors_derive_from_base(exc):
    assert issubclass(exc, EvalHarnessError)


def test_module_aliases_are_the_same_class():
    # Re-exports point at the centralized definitions, not copies.
    from evalharness import errors

    assert ConfigError is errors.ConfigError
    assert ProviderError is errors.ProviderError


def test_catching_base_catches_subclass():
    with pytest.raises(EvalHarnessError):
        raise DatasetError("boom")
