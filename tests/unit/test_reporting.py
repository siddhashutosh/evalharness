from evalharness.errors import ReportError
from evalharness.models import (
    AggregateMetrics,
    CaseResult,
    RunResult,
    ScoreResult,
)
from evalharness.report import HtmlReporter, Reporter, TerminalReporter


def _run():
    return RunResult(
        suite="s",
        target_model="claude-opus-4-8",
        cases=[
            CaseResult(
                case_id="a",
                input="i",
                output="o",
                scores=[ScoreResult(scorer="contains", score=1.0, passed=True)],
                passed=True,
            )
        ],
        metrics=AggregateMetrics(
            total=1, passed=1, pass_rate=1.0, mean_score_by_scorer={"contains": 1.0}
        ),
        created_at="2026-07-08T00:00:00Z",
    )


def test_reporters_satisfy_protocol():
    assert isinstance(TerminalReporter(), Reporter)
    assert isinstance(HtmlReporter("x.html"), Reporter)


def test_html_reporter_writes_self_contained_file(tmp_path):
    out = tmp_path / "report.html"
    HtmlReporter(str(out)).render(_run())
    text = out.read_text(encoding="utf-8")
    assert "<!doctype html>" in text
    assert "eval report" in text
    # Self-contained: no external asset references.
    assert "http://" not in text and "https://" not in text
    assert "<link" not in text and "src=" not in text


def test_html_reporter_raises_on_bad_path(tmp_path):
    bad = tmp_path / "nope" / "deep" / "report.html"  # parent dir missing
    try:
        HtmlReporter(str(bad)).render(_run())
    except ReportError:
        return
    raise AssertionError("expected ReportError for unwritable path")


def test_terminal_reporter_runs_without_error():
    # Smoke test: rendering must not raise on a normal run.
    TerminalReporter().render(_run())
