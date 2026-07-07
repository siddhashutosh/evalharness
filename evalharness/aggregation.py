"""Metrics aggregation.

Extracted from the runner so that "how a run is rolled up into metrics" is a
single, independently testable responsibility (SRP). The aggregator depends only
on the data model and a cost callback, not on any provider or runner internals.
"""

from __future__ import annotations

from collections.abc import Callable

from evalharness.models import AggregateMetrics, CaseResult, Usage

# (model, usage) -> estimated USD
CostFn = Callable[[str, Usage], float]


class MetricsAggregator:
    """Rolls a list of ``CaseResult`` into ``AggregateMetrics``."""

    def __init__(self, cost_fn: CostFn) -> None:
        self._cost_fn = cost_fn

    def aggregate(self, model: str, results: list[CaseResult]) -> AggregateMetrics:
        total = len(results)
        passed = sum(1 for r in results if r.passed)

        mean_by_scorer = self._mean_scores(results)
        total_usage = self._total_usage(results)
        cost = self._cost_fn(model, total_usage)

        return AggregateMetrics(
            total=total,
            passed=passed,
            pass_rate=(passed / total) if total else 0.0,
            mean_score_by_scorer=mean_by_scorer,
            input_tokens=total_usage.input_tokens,
            output_tokens=total_usage.output_tokens,
            est_cost_usd=round(cost, 6),
        )

    @staticmethod
    def _mean_scores(results: list[CaseResult]) -> dict[str, float]:
        sums: dict[str, float] = {}
        counts: dict[str, int] = {}
        for r in results:
            for s in r.scores:
                sums[s.scorer] = sums.get(s.scorer, 0.0) + s.score
                counts[s.scorer] = counts.get(s.scorer, 0) + 1
        return {name: sums[name] / counts[name] for name in sums if counts[name]}

    @staticmethod
    def _total_usage(results: list[CaseResult]) -> Usage:
        total = Usage()
        for r in results:
            total = total + r.usage
        return total
