from evalharness.config import Thresholds
from evalharness.models import (
    AggregateMetrics,
    Baseline,
    CaseResult,
    RunResult,
    ScoreResult,
)
from evalharness.regression import compare


def make_run(pass_map, scorer_mean, *, suite="s"):
    """pass_map: {case_id: passed}; scorer_mean: {scorer: mean}."""
    cases = [
        CaseResult(
            case_id=cid,
            input="i",
            output="o",
            scores=[ScoreResult(scorer="contains", score=1.0 if p else 0.0, passed=p)],
            passed=p,
        )
        for cid, p in pass_map.items()
    ]
    passed = sum(1 for p in pass_map.values() if p)
    total = len(pass_map)
    return RunResult(
        suite=suite,
        target_model="m",
        cases=cases,
        metrics=AggregateMetrics(
            total=total,
            passed=passed,
            pass_rate=passed / total,
            mean_score_by_scorer=scorer_mean,
        ),
        created_at="2026-01-01T00:00:00Z",
    )


def test_no_regression_passes():
    base = Baseline(run=make_run({"a": True, "b": True}, {"contains": 1.0}))
    cur = make_run({"a": True, "b": True}, {"contains": 1.0})
    d = compare(cur, base, Thresholds())
    assert d.passed is True
    assert d.reasons == []


def test_case_pass_to_fail_regression():
    base = Baseline(run=make_run({"a": True, "b": True}, {"contains": 1.0}))
    cur = make_run({"a": True, "b": False}, {"contains": 0.5})
    d = compare(cur, base, Thresholds())
    assert d.passed is False
    kinds = {r.kind for r in d.reasons}
    assert "case_regression" in kinds
    assert any("b" in r.detail for r in d.reasons)


def test_pass_rate_drop_detected():
    base = Baseline(run=make_run({"a": True, "b": True}, {"contains": 1.0}))
    cur = make_run({"a": True, "b": False}, {"contains": 1.0})  # same scorer mean
    d = compare(cur, base, Thresholds(pass_rate_drop=0.0, scorer_mean_drop=1.0))
    assert d.passed is False
    assert any(r.kind == "pass_rate_drop" for r in d.reasons)


def test_scorer_mean_drop_detected():
    base = Baseline(run=make_run({"a": True}, {"contains": 1.0, "embedding": 0.9}))
    cur = make_run({"a": True}, {"contains": 1.0, "embedding": 0.7})
    d = compare(cur, base, Thresholds(pass_rate_drop=1.0, scorer_mean_drop=0.05))
    assert d.passed is False
    assert any(r.kind == "scorer_drop" and "embedding" in r.detail for r in d.reasons)


def test_new_case_does_not_regress():
    base = Baseline(run=make_run({"a": True}, {"contains": 1.0}))
    cur = make_run({"a": True, "new": True}, {"contains": 1.0})
    d = compare(cur, base, Thresholds())
    assert d.passed is True
