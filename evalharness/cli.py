"""Command-line interface.

    evalharness [--log-level LEVEL] run   <suite.yaml> [--no-cache] [--html f] [--json f]
    evalharness baseline <suite.yaml> [-o baseline.json]
    evalharness gate  <suite.yaml> --baseline baseline.json [--html f]
    evalharness report <run.json> [--html f]
    evalharness cache clear

``gate`` exits non-zero on a regression — that is the CI hook.
Exit codes: 0 = pass, 1 = regression, 2 = usage/validation error.
"""

from __future__ import annotations

import datetime as _dt
import subprocess
from pathlib import Path

import typer

from evalharness.cache import Cache, NullCache, ResponseCache
from evalharness.config import load_suite
from evalharness.errors import EvalHarnessError
from evalharness.dataset import load_golden_set
from evalharness.log import configure, get_logger
from evalharness.models import Baseline, RunResult
from evalharness.providers import get_provider
from evalharness.regression import compare
from evalharness.report import HtmlReporter, TerminalReporter
from evalharness.runner import Runner
from evalharness.scorers import build_scorers

app = typer.Typer(add_completion=False, help="LLM evaluation harness.")
cache_app = typer.Typer(help="Manage the response cache.")
app.add_typer(cache_app, name="cache")

_log = get_logger(__name__)


@app.callback()
def _main(
    log_level: str = typer.Option(
        "warning",
        "--log-level",
        "-l",
        help="Logging level: debug, info, warning, error.",
    ),
) -> None:
    configure(log_level)


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def _git_sha() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return out.stdout.strip() or None if out.returncode == 0 else None
    except Exception:
        return None


def _build_and_run(suite_path: str, *, use_cache: bool) -> RunResult:
    config = load_suite(suite_path)
    golden = load_golden_set(config.golden_set_path())
    provider = get_provider(config.provider)
    cache: Cache = ResponseCache() if use_cache else NullCache()
    scorers = build_scorers(config.scorers, provider=provider, judge_model=config.judge_model)
    runner = Runner(config, provider, cache, scorers, now=_now())
    return runner.run(golden)


def _fail(msg: str) -> None:
    typer.secho(f"error: {msg}", fg="red", err=True)
    raise typer.Exit(code=2)


@app.command()
def run(
    suite: str = typer.Argument(..., help="Path to the suite YAML."),
    no_cache: bool = typer.Option(False, "--no-cache", help="Bypass the response cache."),
    html: str = typer.Option("", "--html", help="Write an HTML report to this path."),
    json_out: str = typer.Option("", "--json", help="Dump the RunResult JSON here."),
) -> None:
    """Run a suite and print a report."""
    try:
        result = _build_and_run(suite, use_cache=not no_cache)
        TerminalReporter().render(result)
        if html:
            HtmlReporter(html).render(result)
            typer.echo(f"wrote HTML report: {html}")
        if json_out:
            Path(json_out).write_text(result.model_dump_json(indent=2), encoding="utf-8")
            typer.echo(f"wrote run JSON: {json_out}")
    except EvalHarnessError as exc:
        _fail(str(exc))


@app.command()
def baseline(
    suite: str = typer.Argument(..., help="Path to the suite YAML."),
    out: str = typer.Option("baseline.json", "-o", "--out", help="Baseline output path."),
    no_cache: bool = typer.Option(False, "--no-cache"),
) -> None:
    """Run a suite and save the result as a baseline."""
    try:
        result = _build_and_run(suite, use_cache=not no_cache)
        bl = Baseline(run=result, git_sha=_git_sha())
        Path(out).write_text(bl.model_dump_json(indent=2), encoding="utf-8")
    except EvalHarnessError as exc:
        _fail(str(exc))
        return
    TerminalReporter().render(result)
    typer.secho(f"saved baseline: {out}", fg="green")


@app.command()
def gate(
    suite: str = typer.Argument(..., help="Path to the suite YAML."),
    baseline_path: str = typer.Option(..., "--baseline", help="Baseline JSON to compare against."),
    html: str = typer.Option("", "--html", help="Write an HTML report to this path."),
    no_cache: bool = typer.Option(False, "--no-cache"),
) -> None:
    """Run a suite, compare to a baseline, and FAIL (exit 1) on regression."""
    bl_path = Path(baseline_path)
    if not bl_path.exists():
        _fail(f"baseline not found: {baseline_path}")
    try:
        config = load_suite(suite)
        baseline = Baseline.model_validate_json(bl_path.read_text(encoding="utf-8"))
        result = _build_and_run(suite, use_cache=not no_cache)
    except EvalHarnessError as exc:
        _fail(str(exc))
        return

    decision = compare(result, baseline, config.thresholds)
    TerminalReporter().render(result, decision)
    if html:
        HtmlReporter(html).render(result, decision, baseline)
        typer.echo(f"wrote HTML report: {html}")
    if not decision.passed:
        _log.warning("gate failed with %d regression reason(s)", len(decision.reasons))
    raise typer.Exit(code=0 if decision.passed else 1)


@app.command()
def report(
    run_json: str = typer.Argument(..., help="A RunResult JSON dumped by `run --json`."),
    html: str = typer.Option("", "--html", help="Write an HTML report to this path."),
) -> None:
    """Re-render a saved run result."""
    p = Path(run_json)
    if not p.exists():
        _fail(f"run JSON not found: {run_json}")
    try:
        result = RunResult.model_validate_json(p.read_text(encoding="utf-8"))
        TerminalReporter().render(result)
        if html:
            HtmlReporter(html).render(result)
            typer.echo(f"wrote HTML report: {html}")
    except EvalHarnessError as exc:
        _fail(str(exc))


@cache_app.command("clear")
def cache_clear() -> None:
    """Delete all cached provider responses."""
    removed = ResponseCache().clear()
    typer.echo(f"cleared {removed} cache entries")


if __name__ == "__main__":  # pragma: no cover
    app()
