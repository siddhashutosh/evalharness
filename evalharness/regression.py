"""Regression detection: compare a run against a baseline and decide the gate.

Three signals fail the gate (see ``docs/LLD.md`` §9):
  1. any case that regressed pass -> fail,
  2. an aggregate pass-rate drop beyond tolerance,
  3. a per-scorer mean-score drop beyond tolerance.
New cases (absent from the baseline) never fail the gate.
"""

from __future__ import annotations

from evalharness.config import Thresholds
from evalharness.models import Baseline, GateDecision, GateReason, RunResult


def compare(
    current: RunResult, baseline: Baseline, thresholds: Thresholds
) -> GateDecision:
    reasons: list[GateReason] = []
    base = baseline.run

    # 1. Per-case pass -> fail regressions.
    base_by_id = {c.case_id: c for c in base.cases}
    for cur in current.cases:
        prev = base_by_id.get(cur.case_id)
        if prev is not None and prev.passed and not cur.passed:
            note = cur.error or _first_failing_detail(cur)
            reasons.append(
                GateReason(
                    kind="case_regression",
                    detail=f"case {cur.case_id!r} regressed pass -> fail ({note})",
                )
            )

    # 2. Aggregate pass-rate drop.
    drop = base.metrics.pass_rate - current.metrics.pass_rate
    if drop > thresholds.pass_rate_drop:
        reasons.append(
            GateReason(
                kind="pass_rate_drop",
                detail=(
                    f"pass rate dropped {base.metrics.pass_rate:.1%} -> "
                    f"{current.metrics.pass_rate:.1%} "
                    f"(delta {drop:.1%} > tolerance {thresholds.pass_rate_drop:.1%})"
                ),
            )
        )

    # 3. Per-scorer mean-score drops.
    for scorer, base_mean in base.metrics.mean_score_by_scorer.items():
        cur_mean = current.metrics.mean_score_by_scorer.get(scorer)
        if cur_mean is None:
            continue
        sdrop = base_mean - cur_mean
        if sdrop > thresholds.scorer_mean_drop:
            reasons.append(
                GateReason(
                    kind="scorer_drop",
                    detail=(
                        f"scorer {scorer!r} mean dropped {base_mean:.3f} -> "
                        f"{cur_mean:.3f} (delta {sdrop:.3f} > tolerance "
                        f"{thresholds.scorer_mean_drop:.3f})"
                    ),
                )
            )

    return GateDecision(passed=len(reasons) == 0, reasons=reasons)


def _first_failing_detail(case_result) -> str:
    for s in case_result.scores:
        if not s.passed:
            return f"{s.scorer}: {s.detail}"
    return "no passing scorers"
