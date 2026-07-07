from evalharness.aggregation import MetricsAggregator
from evalharness.models import CaseResult, ScoreResult, Usage


def _case(cid, passed, scores, usage=Usage()):
    return CaseResult(
        case_id=cid, input="i", output="o", scores=scores, passed=passed, usage=usage
    )


def test_aggregate_pass_rate_and_means():
    agg = MetricsAggregator(cost_fn=lambda model, usage: 0.0)
    cases = [
        _case("a", True, [ScoreResult(scorer="s", score=1.0, passed=True)]),
        _case("b", False, [ScoreResult(scorer="s", score=0.0, passed=False)]),
    ]
    m = agg.aggregate("claude-opus-4-8", cases)
    assert m.total == 2
    assert m.passed == 1
    assert m.pass_rate == 0.5
    assert m.mean_score_by_scorer["s"] == 0.5


def test_aggregate_tokens_and_cost():
    # cost_fn is injected: the aggregator has no provider dependency.
    agg = MetricsAggregator(cost_fn=lambda model, usage: usage.output_tokens * 0.01)
    cases = [
        _case("a", True, [], usage=Usage(input_tokens=10, output_tokens=5)),
        _case("b", True, [], usage=Usage(input_tokens=3, output_tokens=2)),
    ]
    m = agg.aggregate("m", cases)
    assert m.input_tokens == 13
    assert m.output_tokens == 7
    assert m.est_cost_usd == 0.07


def test_aggregate_empty():
    agg = MetricsAggregator(cost_fn=lambda model, usage: 0.0)
    m = agg.aggregate("m", [])
    assert m.total == 0
    assert m.pass_rate == 0.0
