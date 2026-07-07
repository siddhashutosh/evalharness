"""Scorer registry.

``build_scorer`` constructs a scorer from a ``ScorerSpec``, injecting the
provider and judge model where needed (the llm_judge scorer). New scorers are
registered by name and referenced from a suite config with no runner changes.
"""

from __future__ import annotations

from evalharness.config import ScorerSpec
from evalharness.providers.base import Provider
from evalharness.scorers.base import Scorer, ScorerError

__all__ = ["Scorer", "ScorerError", "build_scorer", "build_scorers"]


def build_scorer(
    spec: ScorerSpec, *, provider: Provider | None = None, judge_model: str = "claude-opus-4-8"
) -> Scorer:
    """Construct a single scorer from its spec."""
    t = spec.type
    opts = dict(spec.options)

    if t == "exact":
        from evalharness.scorers.exact import ExactScorer

        return ExactScorer(threshold=spec.threshold, required=spec.required, **opts)
    if t == "contains":
        from evalharness.scorers.contains import ContainsScorer

        return ContainsScorer(threshold=spec.threshold, required=spec.required, **opts)
    if t == "regex":
        from evalharness.scorers.regex import RegexScorer

        return RegexScorer(threshold=spec.threshold, required=spec.required, **opts)
    if t == "embedding":
        from evalharness.scorers.embedding import EmbeddingScorer

        return EmbeddingScorer(threshold=spec.threshold, required=spec.required, **opts)
    if t == "llm_judge":
        from evalharness.scorers.llm_judge import LLMJudgeScorer

        if provider is None:
            raise ScorerError("llm_judge scorer requires a provider")
        return LLMJudgeScorer(
            threshold=spec.threshold,
            required=spec.required,
            provider=provider,
            judge_model=judge_model,
            **opts,
        )

    raise ScorerError(f"unknown scorer type: {t!r}")


def build_scorers(
    specs: list[ScorerSpec],
    *,
    provider: Provider | None = None,
    judge_model: str = "claude-opus-4-8",
) -> list[Scorer]:
    """Construct all scorers for a suite."""
    return [build_scorer(s, provider=provider, judge_model=judge_model) for s in specs]
