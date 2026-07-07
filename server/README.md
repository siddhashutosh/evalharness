# evalharness — backend API

A small FastAPI service that bridges the `evalharness` Python library to the web
dashboard. It runs suites, saves baselines, and gates — reusing the exact same
`Runner`, scorers, and regression logic the CLI uses.

## Run it

From the **repo root**:

```bash
# 1. install the harness + backend deps (use the repo's virtualenv)
pip install -e .
pip install -r server/requirements.txt

# 2. start the API
uvicorn server.app:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive OpenAPI UI.

## Demo mode vs live mode

Every run takes a `mode`:

- **`demo`** (default) — a deterministic provider answers the golden set, with a
  `quality` knob (0..1) that degrades a fraction of answers to wrong
  distractors. **No API key needed** — this is what powers the dashboard's live
  regression demo. See `demo.py`.
- **`live`** — uses the real provider named in the suite config (e.g. Anthropic),
  which requires `ANTHROPIC_API_KEY`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/health` | Liveness check |
| GET  | `/api/suites` | List available suites (from `server/suites/`) |
| GET  | `/api/suites/{name}` | Suite detail + golden-set cases |
| POST | `/api/run` | Run a suite → `RunResult` (persisted) |
| POST | `/api/baseline` | Run + save a baseline |
| POST | `/api/gate` | Run + compare to a baseline → `GateDecision` |
| GET  | `/api/runs` | Run history |
| GET  | `/api/runs/{id}` | A stored run |
| GET  | `/api/baselines` | Saved baselines |

Request body for run/baseline/gate:
`{ "suite": "capitals-qa", "quality": 1.0, "mode": "demo", "baseline_id": null }`

## Layout

```
server/
  app.py         FastAPI app + routes
  service.py     bridges HTTP → the evalharness library
  demo.py        offline demo provider (seeded from a golden set)
  store.py       JSON persistence for runs & baselines (under server/.data/)
  suites/        demo suite configs + golden sets
```

Runs and baselines are written under `server/.data/` (gitignored).
