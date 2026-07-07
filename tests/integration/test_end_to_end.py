"""End-to-end pipeline test using MockProvider — no API key, no network.

Exercises: prompt rendering -> provider (cached) -> scorers (contains + judge)
-> aggregation -> baseline save -> regression gate. This is the offline proof
that a quality drop makes the gate fail.
"""

from evalharness.cache import ResponseCache
from evalharness.config import ScorerSpec, SuiteConfig, Thresholds
from evalharness.models import Baseline, GoldenSet, TestCase
from evalharness.providers.mock import MockProvider
from evalharness.regression import compare
from evalharness.runner import Runner
from evalharness.scorers import build_scorers

GOLDEN = GoldenSet(
    name="capitals",
    cases=[
        TestCase(id="france", input="Capital of France?", expected="Paris", rubric="says Paris"),
        TestCase(id="japan", input="Capital of Japan?", expected="Tokyo", rubric="says Tokyo"),
    ],
)

# Correct answers, keyed by the rendered prompt (template is "{input}").
CORRECT = {"Capital of France?": "Paris", "Capital of Japan?": "Tokyo"}
# A degraded system: France is now wrong.
DEGRADED = {"Capital of France?": "London", "Capital of Japan?": "Tokyo"}


def _judge(prompt: str) -> str:
    answer = prompt.split("ANSWER TO GRADE:")[-1]
    good = ("Paris" in answer) or ("Tokyo" in answer)
    if good:
        return '{"score": 0.95, "pass": true, "reasoning": "correct city"}'
    return '{"score": 0.1, "pass": false, "reasoning": "wrong city"}'


def _config() -> SuiteConfig:
    return SuiteConfig(
        name="capitals",
        golden_set="unused.yaml",
        provider="mock",
        target_model="claude-opus-4-8",
        judge_model="claude-opus-4-8",
        prompt_template="{input}",
        scorers=[
            ScorerSpec(type="contains", threshold=1.0, required=True),
            ScorerSpec(type="llm_judge", threshold=0.6),
        ],
        thresholds=Thresholds(pass_rate_drop=0.0, scorer_mean_drop=0.05),
        concurrency=1,
    )


def _run(responses, tmp_path):
    config = _config()
    provider = MockProvider(responses=responses, judge_fn=_judge)
    cache = ResponseCache(root=str(tmp_path / "cache"))
    scorers = build_scorers(config.scorers, provider=provider, judge_model=config.judge_model)
    runner = Runner(config, provider, cache, scorers, now="2026-07-08T00:00:00Z")
    return runner.run(GOLDEN)


def test_good_run_all_pass(tmp_path):
    result = _run(CORRECT, tmp_path)
    assert result.metrics.pass_rate == 1.0
    assert result.metrics.passed == 2
    assert result.metrics.mean_score_by_scorer["contains"] == 1.0


def test_degraded_run_gate_fails(tmp_path):
    baseline_run = _run(CORRECT, tmp_path / "a")
    baseline = Baseline(run=baseline_run)

    degraded = _run(DEGRADED, tmp_path / "b")
    assert degraded.metrics.pass_rate == 0.5  # France regressed

    decision = compare(degraded, baseline, _config().thresholds)
    assert decision.passed is False
    # The specific regressed case is named.
    assert any("france" in r.detail for r in decision.reasons)


def test_cache_hit_on_rerun(tmp_path):
    config = _config()
    provider = MockProvider(responses=CORRECT, judge_fn=_judge)
    cache = ResponseCache(root=str(tmp_path / "cache"))
    scorers = build_scorers(config.scorers, provider=provider, judge_model=config.judge_model)
    runner = Runner(config, provider, cache, scorers, now="t")

    runner.run(GOLDEN)  # populate cache
    second = runner.run(GOLDEN)  # should read from cache
    # Cached target responses contribute zero usage/cost.
    assert second.metrics.input_tokens == 0
    assert second.metrics.est_cost_usd == 0.0
    assert second.metrics.pass_rate == 1.0


def test_provider_error_isolated(tmp_path):
    class Boom(MockProvider):
        def complete(self, *a, **k):
            raise RuntimeError("network down")

    config = _config()
    provider = Boom()
    cache = ResponseCache(root=str(tmp_path / "c"), enabled=False)
    scorers = build_scorers(config.scorers, provider=provider, judge_model=config.judge_model)
    runner = Runner(config, provider, cache, scorers, now="t")
    result = runner.run(GOLDEN)
    assert result.metrics.pass_rate == 0.0
    assert all(c.error and "provider error" in c.error for c in result.cases)
