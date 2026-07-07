# evalharness

**A small, reusable LLM evaluation harness** — golden test sets, LLM-as-judge
scoring, regression detection against a baseline, and a CI quality gate that
**fails the build when quality drops**.

Traditional tests assert `f(x) == y`. LLM outputs are non-deterministic and
graded, not equal — so you can't gate a release on string equality. `evalharness`
reframes LLM quality as what it actually is: **test infrastructure with a
probabilistic twist**. Point it at your prompt + model, run it, save a baseline,
and every change after that is automatically graded against that baseline.

```
golden set ──► run each input through your prompt+model ──► score (exact / regex /
contains / semantic embedding / LLM-judge) ──► compare to baseline ──► pass or FAIL the gate
```

---

## What is this? (plain English)

It's **automated testing for AI features** — the same idea as unit tests, but for
LLM outputs instead of ordinary code.

Regular software is predictable: `add(2, 2)` is always `4`, so `assert add(2,2) == 4`
catches bugs for you. AI isn't — the **same prompt returns different answers**, and
"correct" is usually a matter of **degree**, not exact equality. So when you change
a prompt or swap models, you can't easily tell whether quality went up, down, or
sideways. Most teams just eyeball a few outputs and hope.

`evalharness` closes that gap. You write **golden test cases** (inputs with known-good
answers/rubrics); it runs them through your AI, **scores** the outputs (including an
LLM-as-judge that grades against your rubric), compares the results to a saved
**baseline**, and **fails the build** if quality dropped — so a bad prompt or model
change is caught automatically, before it reaches users.

**Who it's for:** anyone shipping an AI feature (chatbot, summarizer, classifier,
RAG, agent) who needs objective, repeatable proof that a change didn't quietly make
things worse.

**Concrete example:** you tweak a support bot's prompt to be more concise.
evalharness re-runs your 50 golden questions, compares to last week's baseline, and
reports *"pass rate 92% → 78%; 'refund policy' and 'cancellation' now fail"* — before
customers ever see it.

---

## See it catch a regression (60-second demo)

The [live dashboard](https://evalharness-wine.vercel.app) lets you watch the whole
loop with no setup:

1. **Run a suite** — pick `capitals-qa`, hit **Run eval**. At full quality every case
   passes (100%).
2. **Save a baseline** — click **Save baseline**. This is now your "known-good" bar.
3. **Degrade quality** — drag the **model quality** slider down (this simulates a worse
   prompt/model that gets some answers wrong).
4. **Run the gate** — hit **Run gate**. It compares the degraded run to your baseline
   and turns **red**, naming exactly what broke:

   ```
   GATE FAILED
   - case 'australia' regressed pass → fail (contains: missing expected)
   - pass rate dropped 100.0% → 75.0% (delta 25.0% > tolerance 0.0%)
   - scorer 'llm_judge' mean dropped 0.950 → 0.750
   ```

Same flow from the command line:

```bash
evalharness baseline examples/suite.yaml -o baseline.json   # capture "known-good"
# ...now weaken the prompt or change target_model in the suite...
evalharness gate examples/suite.yaml --baseline baseline.json   # exits 1 → CI goes red
```

That non-zero exit code is the whole point: wired into CI, a quality drop fails the
build exactly like a failing test.

---

## Why it stands out

Most "evals" in the wild are a one-off script that prints outputs for a human to
eyeball. This is the opposite: a **reusable framework** with a pinned, cached,
reproducible pipeline; composable scorers including a **structured** LLM judge;
an explicit regression algorithm; and a CI gate that exits non-zero on a
quality drop.

- **Golden test sets** — versioned YAML/JSONL datasets with inputs, expected
  answers, and grading rubrics.
- **Five scorers** — `exact`, `regex`, `contains`, `embedding` (local semantic
  similarity), and `llm_judge` (a strong model grades against a rubric, returning
  a schema-validated verdict).
- **Regression detection** — flags any case that regressed pass→fail, plus
  aggregate pass-rate and per-scorer drops beyond configurable tolerances.
- **Response cache** — re-runs are free and reproducible; changing the prompt or
  model changes the cache key, so the cache never masks a real change.
- **Reports** — a `rich` terminal table and a self-contained HTML report.
- **CI gate** — `evalharness gate` exits non-zero on regression; a GitHub
  Actions workflow is included.
- **Pluggable** — Anthropic provider ships first; a new backend or scorer is one
  small class.

---

## Install

```bash
pip install -e .              # core (offline scorers + CLI)
pip install -e ".[all]"       # + Anthropic SDK and local embedding model
pip install -e ".[dev]"       # + pytest
```

Python 3.9+ (verified on 3.9; 3.11+ recommended). Live scoring against Anthropic
uses `ANTHROPIC_API_KEY` (or an `ant auth` profile) — keys are read from the
environment only, never hardcoded or written to reports.

---

## Quickstart

A suite config points at a golden set, a provider/model, and a list of scorers:

```yaml
# examples/suite.yaml
name: capitals-qa
golden_set: golden_set.yaml
provider: anthropic
target_model: claude-opus-4-8
judge_model: claude-opus-4-8
prompt_template: "{input}"
scorers:
  - {type: contains, threshold: 1.0, required: true}   # must contain the answer
  - {type: embedding, threshold: 0.6}                  # semantic sanity (local)
  - {type: llm_judge, threshold: 0.6}                  # rubric-based quality
thresholds:
  pass_rate_drop: 0.0
  scorer_mean_drop: 0.05
```

```bash
# 1. Run the suite and get a terminal + HTML report
evalharness run examples/suite.yaml --html report.html

# 2. Save the current result as the baseline (commit this)
evalharness baseline examples/suite.yaml -o examples/baseline.json

# 3. Gate future changes against the baseline (exit 1 on regression)
evalharness gate examples/suite.yaml --baseline examples/baseline.json --html report.html
```

### See a regression get caught
Weaken the prompt (e.g. tell the model to guess quickly) or swap `target_model`,
then re-run step 3. The gate exits non-zero and names exactly what regressed:

```
GATE FAILED
- case 'france' regressed pass -> fail (contains: missing expected)
- pass rate dropped 100.0% -> 50.0% (delta 50.0% > tolerance 0.0%)
- scorer 'llm_judge' mean dropped 0.950 -> 0.525 (delta 0.425 > tolerance 0.050)
```

---

## CLI

| Command | Purpose |
|---------|---------|
| `evalharness run <suite.yaml> [--html f] [--json f] [--no-cache]` | Run a suite, print/write reports. |
| `evalharness baseline <suite.yaml> [-o baseline.json]` | Run and save a baseline. |
| `evalharness gate <suite.yaml> --baseline b.json [--html f]` | Run, compare, **exit 1 on regression**. |
| `evalharness report <run.json> [--html f]` | Re-render a saved run. |
| `evalharness cache clear` | Clear the response cache. |

Exit codes: `0` pass · `1` regression · `2` usage/validation error.

---

## Continuous integration

`.github/workflows/eval.yml` runs on every push/PR:

1. **Always** — the offline `pytest` suite (via a mock provider, no API key), which
   gates the harness's own logic.
2. **When `ANTHROPIC_API_KEY` and a committed `examples/baseline.json` are present**
   — the live eval + `evalharness gate`, uploading the HTML report as an artifact.

A prompt/model change that regresses quality turns the PR check red.

---

## Web dashboard & API

A full-stack UI ships alongside the library: a **FastAPI backend** (`server/`)
that bridges to the harness, and a **vibrant Next.js dashboard** (`web/`) to run
suites, save baselines, and watch the gate catch regressions live.

```bash
# backend (from repo root) — demo mode needs no API key
pip install -e . && pip install -r server/requirements.txt
uvicorn server.app:app --reload --port 8000

# frontend (from web/)
cd web && cp .env.local.example .env.local && npm install && npm run dev
# → http://localhost:3000
```

The dashboard has a **model-quality slider**: run at full quality, save a
baseline, drag quality down, and run the gate to see exactly which cases regress.
Demo mode uses a deterministic offline provider (no key); live mode calls the
real model. Details: [`server/README.md`](server/README.md) ·
[`web/README.md`](web/README.md).

## Architecture & SOLID

The pipeline is built around small, single-purpose components wired together by
dependency injection — so it is easy to test, extend, and reason about.

| Principle | How it shows up |
|-----------|-----------------|
| **Single Responsibility** | Each module does one thing: `dataset` loads, `runner` orchestrates, `aggregation.MetricsAggregator` rolls up metrics, `regression` decides the gate, `report`'s `TerminalReporter`/`HtmlReporter` render. |
| **Open/Closed** | Add a provider or scorer by implementing an interface and registering it — no edits to the runner. New reporters implement the `Reporter` protocol. |
| **Liskov Substitution** | `MockProvider`, `AnthropicProvider`, `OpenAIProvider` are interchangeable behind `Provider`; `ResponseCache`/`NullCache` behind `Cache`. |
| **Interface Segregation** | Interfaces are one method of intent each: `Provider.complete`, `Scorer.score`, `Reporter.render`, `Cache.get/put`. |
| **Dependency Inversion** | The `Runner` depends on the `Provider`, `Cache`, `Scorer`, and `MetricsAggregator` *abstractions*, all injected in its constructor — it never imports a concrete provider or scorer. |

Key seams:

```
Runner(config, provider: Provider, cache: Cache, scorers: [Scorer], aggregator: MetricsAggregator)
Reporter (protocol) ── TerminalReporter · HtmlReporter
Cache    (protocol) ── ResponseCache · NullCache
Provider (protocol) ── AnthropicProvider · OpenAIProvider · MockProvider
Scorer   (protocol) ── Exact · Contains · Regex · Embedding · LLMJudge
```

## Error handling

All expected failures derive from a single base, `EvalHarnessError`
(`evalharness/errors.py`): `ConfigError`, `DatasetError`, `ProviderError`,
`ScorerError`, `CacheError`, `ReportError`. Catch the base to handle everything,
or a subclass when you care about the difference. Failures are isolated where it
matters: a provider or scorer error on one case is recorded on that case and the
run continues; cache read/write problems degrade gracefully instead of crashing.
The CLI turns any `EvalHarnessError` into a clean message and exit code `2`.

## Logging

Structured logging lives under the `evalharness` namespace
(`evalharness/log.py`). The library never configures handlers on import; the CLI
does. Control verbosity with the global flag:

```bash
evalharness --log-level debug run examples/suite.yaml
```

Levels: `debug` (per-case verdicts, cache hits/misses), `info` (run start/finish,
pass rate, cost), `warning` (retries, corrupt cache, scorer errors), `error`.
Embedding it in your own app? Call `evalharness.configure_logging("info")` or
attach your own handler to the `evalharness` logger.

## Extending

- **New scorer:** implement `Scorer.score(case, output) -> ScoreResult`, register
  it in `evalharness/scorers/__init__.py`, reference it by `type` in a suite.
- **New provider:** implement `Provider.complete(...)` + `cost(...)`, register it;
  the runner and scorers don't change.
- **New report format:** implement `Reporter.render(run, gate, baseline)`.

---

## Design docs

Full requirements and design are in [`docs/`](docs/):

- [`docs/SRS.docx`](docs/SRS.docx) — Software Requirements Specification
- [`docs/HLD.docx`](docs/HLD.docx) — High-Level Design
- [`docs/LLD.docx`](docs/LLD.docx) — Low-Level Design
- [`docs/DESIGN.docx`](docs/DESIGN.docx) — Design Document (rationale & trade-offs)

---

## Tests

Tests live in a dedicated folder, split by scope:

```
tests/
  unit/          # scorers, dataset, config, cache, regression, aggregation,
                 # reporting, errors, logging  (fast, isolated)
  integration/   # full runner -> gate pipeline via the mock provider
```

```bash
pip install -e ".[dev]"
pytest                     # 49 tests, fully offline (mock provider, no API key)
pytest tests/unit          # unit only
pytest tests/integration   # integration only
```

## License
MIT
