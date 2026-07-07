from evalharness.config import ScorerSpec
from evalharness.models import TestCase
from evalharness.providers.mock import JUDGE_MARKER, MockProvider
from evalharness.scorers import build_scorer
from evalharness.scorers.contains import ContainsScorer
from evalharness.scorers.exact import ExactScorer
from evalharness.scorers.llm_judge import LLMJudgeScorer
from evalharness.scorers.regex import RegexScorer
from evalharness.scorers.embedding import EmbeddingScorer


def case(**kw):
    base = {"id": "c", "input": "in"}
    base.update(kw)
    return TestCase(**base)


def test_exact_pass_and_fail():
    s = ExactScorer(threshold=1.0)
    assert s.score(case(expected="Paris"), "  paris ").passed is True  # normalized
    assert s.score(case(expected="Paris"), "London").passed is False


def test_contains_expected():
    s = ContainsScorer(threshold=1.0)
    assert s.score(case(expected="Tokyo"), "The capital is Tokyo.").passed is True
    assert s.score(case(expected="Tokyo"), "The capital is Osaka.").passed is False


def test_contains_all_of_partial_score():
    s = ContainsScorer(threshold=1.0, all_of=["a", "b", "c"])
    r = s.score(case(), "only a and b here")
    assert r.score == 2 / 3
    assert r.passed is False


def test_regex():
    s = RegexScorer(threshold=1.0, pattern=r"\d{3}-\d{4}")
    assert s.score(case(), "call 555-1234").passed is True
    assert s.score(case(), "no number").passed is False


def test_embedding_with_injected_encoder():
    # Deterministic fake encoder: identical strings -> identical vectors.
    def encode(texts):
        table = {"Paris": [1.0, 0.0], "Paris.": [1.0, 0.0], "London": [0.0, 1.0]}
        return [table.get(t, [0.5, 0.5]) for t in texts]

    s = EmbeddingScorer(threshold=0.9, encode_fn=encode)
    assert s.score(case(expected="Paris"), "Paris.").passed is True
    assert s.score(case(expected="Paris"), "London").passed is False


def test_llm_judge_structured_verdict():
    def judge(prompt):
        # The judge sees the answer text; grade "Paris" high, else low.
        good = "Paris" in prompt.split("ANSWER TO GRADE:")[-1]
        if good:
            return '{"score": 0.95, "pass": true, "reasoning": "correct"}'
        return '{"score": 0.1, "pass": false, "reasoning": "wrong city"}'

    provider = MockProvider(judge_fn=judge)
    s = LLMJudgeScorer(threshold=0.6, provider=provider, judge_model="claude-opus-4-8")
    assert s.score(case(rubric="must be Paris"), "Paris").passed is True
    assert s.score(case(rubric="must be Paris"), "London").passed is False


def test_llm_judge_prompt_carries_marker():
    captured = {}

    def judge(prompt):
        captured["prompt"] = prompt
        return '{"score": 1.0, "pass": true, "reasoning": "ok"}'

    provider = MockProvider(judge_fn=judge)
    s = LLMJudgeScorer(threshold=0.5, provider=provider)
    s.score(case(rubric="r"), "out")
    assert JUDGE_MARKER in captured["prompt"]


def test_build_scorer_registry():
    s = build_scorer(ScorerSpec(type="contains", threshold=1.0))
    assert s.name == "contains"
