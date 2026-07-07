"""Reporting: a rich terminal summary and a self-contained HTML report.

The HTML report is a single file with inline CSS (no external assets), so it can
be uploaded as a CI artifact and opened anywhere. Theme-aware (light/dark).
See ``docs/LLD.md`` §10.
"""

from __future__ import annotations

import html
from pathlib import Path
from typing import Protocol, runtime_checkable

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from evalharness.errors import ReportError
from evalharness.log import get_logger
from evalharness.models import Baseline, GateDecision, RunResult

_log = get_logger(__name__)

__all__ = [
    "Reporter",
    "TerminalReporter",
    "HtmlReporter",
    "render_terminal",
    "render_html",
]


@runtime_checkable
class Reporter(Protocol):
    """Renders a run result (optionally with a gate decision and baseline)."""

    def render(
        self,
        run: RunResult,
        gate: GateDecision | None = None,
        baseline: Baseline | None = None,
    ) -> None: ...


class TerminalReporter:
    """Renders a run to the terminal via ``rich``."""

    def __init__(self, console: Console | None = None) -> None:
        self._console = console or Console()

    def render(
        self,
        run: RunResult,
        gate: GateDecision | None = None,
        baseline: Baseline | None = None,  # noqa: ARG002 - unused; part of protocol
    ) -> None:
        render_terminal(run, gate, console=self._console)


class HtmlReporter:
    """Renders a run to a self-contained HTML file."""

    def __init__(self, out_path: str) -> None:
        self._out_path = out_path

    def render(
        self,
        run: RunResult,
        gate: GateDecision | None = None,
        baseline: Baseline | None = None,
    ) -> None:
        render_html(run, gate, baseline, self._out_path)


def _truncate(text: str, n: int = 80) -> str:
    text = text.replace("\n", " ").strip()
    return text if len(text) <= n else text[: n - 3] + "..."


# --------------------------------------------------------------------------
# Terminal
# --------------------------------------------------------------------------

def render_terminal(
    run: RunResult, gate: GateDecision | None = None, *, console: Console | None = None
) -> None:
    console = console or Console()
    m = run.metrics

    summary = (
        f"[bold]{run.suite}[/bold]  |  model [cyan]{run.target_model}[/cyan]\n"
        f"pass rate: [bold]{m.pass_rate:.1%}[/bold]  ({m.passed}/{m.total})\n"
        f"tokens: {m.input_tokens} in / {m.output_tokens} out  |  "
        f"est. cost: ${m.est_cost_usd:.4f}"
    )
    if m.mean_score_by_scorer:
        means = "  ".join(f"{k}={v:.2f}" for k, v in m.mean_score_by_scorer.items())
        summary += f"\nmean scores: {means}"
    console.print(Panel(summary, title="eval summary", expand=False))

    table = Table(show_lines=False)
    table.add_column("case")
    table.add_column("pass")
    scorer_names = _ordered_scorers(run)
    for name in scorer_names:
        table.add_column(name, justify="right")
    table.add_column("output")

    for c in run.cases:
        by_name = {s.scorer: s for s in c.scores}
        row = [c.case_id, "[green]PASS[/green]" if c.passed else "[red]FAIL[/red]"]
        for name in scorer_names:
            s = by_name.get(name)
            if s is None:
                row.append("-")
            else:
                colour = "green" if s.passed else "red"
                row.append(f"[{colour}]{s.score:.2f}[/{colour}]")
        row.append(_truncate(c.error or c.output))
        table.add_row(*row)
    console.print(table)

    if gate is not None:
        if gate.passed:
            console.print(Panel("[bold green]GATE PASSED[/bold green]", expand=False))
        else:
            lines = "\n".join(f"- {r.detail}" for r in gate.reasons)
            console.print(
                Panel(
                    f"[bold red]GATE FAILED[/bold red]\n{lines}",
                    title="regression",
                    expand=False,
                )
            )


def _ordered_scorers(run: RunResult) -> list[str]:
    seen: list[str] = []
    for c in run.cases:
        for s in c.scores:
            if s.scorer not in seen:
                seen.append(s.scorer)
    return seen


# --------------------------------------------------------------------------
# HTML
# --------------------------------------------------------------------------

def render_html(
    run: RunResult,
    gate: GateDecision | None,
    baseline: Baseline | None,
    out_path: str,
) -> None:
    m = run.metrics
    scorer_names = _ordered_scorers(run)
    base_by_id = {c.case_id: c for c in baseline.run.cases} if baseline else {}

    gate_html = ""
    if gate is not None:
        cls = "pass" if gate.passed else "fail"
        label = "GATE PASSED" if gate.passed else "GATE FAILED"
        reasons = "".join(f"<li>{html.escape(r.detail)}</li>" for r in gate.reasons)
        gate_html = (
            f'<div class="gate {cls}"><strong>{label}</strong>'
            f'{"<ul>" + reasons + "</ul>" if reasons else ""}</div>'
        )

    means = "".join(
        f"<span class='chip'>{html.escape(k)} {v:.2f}</span>"
        for k, v in m.mean_score_by_scorer.items()
    )

    head_cols = "".join(f"<th>{html.escape(n)}</th>" for n in scorer_names)
    delta_col = "<th>Δ pass vs base</th>" if baseline else ""
    rows = "".join(
        _html_row(c, scorer_names, base_by_id, bool(baseline)) for c in run.cases
    )

    doc = _HTML_TEMPLATE.format(
        suite=html.escape(run.suite),
        model=html.escape(run.target_model),
        created=html.escape(run.created_at),
        pass_rate=f"{m.pass_rate:.1%}",
        passed=m.passed,
        total=m.total,
        tokens_in=m.input_tokens,
        tokens_out=m.output_tokens,
        cost=f"{m.est_cost_usd:.4f}",
        means=means,
        gate=gate_html,
        head_cols=head_cols,
        delta_col=delta_col,
        rows=rows,
    )

    try:
        Path(out_path).write_text(doc, encoding="utf-8")
    except OSError as exc:
        raise ReportError(f"could not write HTML report to {out_path}: {exc}") from exc
    _log.debug("wrote HTML report to %s", out_path)


def _html_row(c, scorer_names, base_by_id, has_baseline) -> str:
    by_name = {s.scorer: s for s in c.scores}
    verdict = "✓" if c.passed else "✗"
    vclass = "ok" if c.passed else "bad"
    cells = ""
    for n in scorer_names:
        s = by_name.get(n)
        if s is None:
            cells += "<td>-</td>"
        else:
            sc = "ok" if s.passed else "bad"
            title = html.escape(s.detail)
            cells += f'<td class="{sc}" title="{title}">{s.score:.2f}</td>'

    delta = ""
    if has_baseline:
        prev = base_by_id.get(c.case_id)
        if prev is None:
            delta = "<td class='new'>new</td>"
        elif prev.passed and not c.passed:
            delta = "<td class='bad'>▼ regressed</td>"
        elif not prev.passed and c.passed:
            delta = "<td class='ok'>▲ fixed</td>"
        else:
            delta = "<td>—</td>"

    body = html.escape(c.error or c.output)
    return (
        f"<tr><td class='id'>{html.escape(c.case_id)}</td>"
        f"<td class='{vclass}'>{verdict}</td>{cells}{delta}"
        f"<td class='out'><details><summary>view</summary>"
        f"<pre>{body}</pre></details></td></tr>"
    )


_HTML_TEMPLATE = """<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>eval report — {suite}</title>
<style>
:root {{ color-scheme: light dark; --bg:#ffffff; --fg:#1a1a1a; --muted:#666;
  --line:#e2e2e2; --ok:#137a3f; --bad:#c62828; --chipbg:#f0f0f0; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#161616; --fg:#e8e8e8;
  --muted:#999; --line:#333; --ok:#4ade80; --bad:#f87171; --chipbg:#262626; }} }}
* {{ box-sizing:border-box; }}
body {{ font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  background:var(--bg); color:var(--fg); margin:0; padding:24px; }}
h1 {{ font-size:20px; margin:0 0 4px; }}
.meta {{ color:var(--muted); margin-bottom:16px; }}
.cards {{ display:flex; flex-wrap:wrap; gap:12px; margin-bottom:16px; }}
.card {{ border:1px solid var(--line); border-radius:8px; padding:12px 16px; }}
.card .big {{ font-size:22px; font-weight:700; }}
.chip {{ display:inline-block; background:var(--chipbg); border-radius:12px;
  padding:2px 10px; margin:2px; font-size:12px; }}
.gate {{ border-radius:8px; padding:12px 16px; margin:16px 0; }}
.gate.pass {{ background:rgba(19,122,63,.12); border:1px solid var(--ok); }}
.gate.fail {{ background:rgba(198,40,40,.12); border:1px solid var(--bad); }}
.gate ul {{ margin:8px 0 0; }}
.wrap {{ overflow-x:auto; }}
table {{ border-collapse:collapse; width:100%; min-width:640px; }}
th,td {{ text-align:left; padding:8px 10px; border-bottom:1px solid var(--line);
  vertical-align:top; }}
th {{ font-size:12px; text-transform:uppercase; letter-spacing:.03em; color:var(--muted); }}
td.ok {{ color:var(--ok); font-weight:600; }}
td.bad {{ color:var(--bad); font-weight:600; }}
td.new {{ color:var(--muted); }}
td.id {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }}
td.out pre {{ white-space:pre-wrap; margin:6px 0 0; max-width:70ch; }}
summary {{ cursor:pointer; color:var(--muted); }}
</style></head>
<body>
<h1>eval report — {suite}</h1>
<div class="meta">model <code>{model}</code> · {created}</div>
{gate}
<div class="cards">
  <div class="card"><div>pass rate</div><div class="big">{pass_rate}</div>
    <div class="meta">{passed}/{total} cases</div></div>
  <div class="card"><div>tokens</div><div class="big">{tokens_in}/{tokens_out}</div>
    <div class="meta">in / out</div></div>
  <div class="card"><div>est. cost</div><div class="big">${cost}</div></div>
  <div class="card"><div>mean scores</div><div>{means}</div></div>
</div>
<div class="wrap"><table>
<thead><tr><th>case</th><th>pass</th>{head_cols}{delta_col}<th>output</th></tr></thead>
<tbody>{rows}</tbody>
</table></div>
</body></html>
"""
