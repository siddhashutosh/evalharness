# evalharness — web dashboard

A vibrant Next.js dashboard for the `evalharness` LLM evaluation framework. Run
suites, save baselines, and watch the regression gate catch quality drops — live.

![stack](https://img.shields.io/badge/Next.js-14-black) ![stack](https://img.shields.io/badge/TypeScript-5-blue) ![stack](https://img.shields.io/badge/Tailwind-3-38bdf8)

## Quickstart

The dashboard talks to the FastAPI backend, so start that first
(see [`../server/README.md`](../server/README.md)):

```bash
# terminal 1 — backend (from repo root)
uvicorn server.app:app --reload --port 8000

# terminal 2 — frontend (from web/)
cp .env.local.example .env.local     # points at http://localhost:8000
npm install
npm run dev                          # http://localhost:3000
```

Then open http://localhost:3000, go to the dashboard, and:

1. Pick a suite → **Run eval** (100% pass at full quality).
2. **Save baseline**.
3. Drag **model quality** down → **Run gate** → watch it fail and name the
   regressed cases.

## What's inside

- **Landing page** (`app/page.tsx`) — the pitch, feature grid, pipeline.
- **Dashboard** (`app/dashboard/page.tsx`) — suite picker, quality slider,
  run/baseline/gate controls, KPI tiles, a pass-rate ring, per-scorer bars, an
  expandable per-case table with baseline deltas, a gate banner, and run history.

## Design notes

- **Vibrant chrome, accessible data.** The UI leans into gradients, glass, and
  neon accents — but the actual data marks (per-scorer bars, pass/fail, deltas)
  use a **validated** categorical + status palette (`lib/palette.ts`): contrast
  ≥ 3:1 on the dark surface, CVD-checked, with direct value labels so identity is
  never carried by color alone.
- **Types mirror the harness.** `lib/types.ts` is a 1:1 TypeScript mirror of the
  Python `RunResult` / `GateDecision` model.

## Prompt playground

The dashboard is a **prompt playground**. Pick one of **10 AI-feature templates**
(`lib/suites.ts`) — support bot, sentiment, summarizer, email drafter, intent
router, PII redactor, NL→SQL, translator, code reviewer, grounded RAG Q&A — and
edit its system prompt. Each feature ships a golden set plus a set of
**prompt-quality signals** (e.g. "list the allowed labels", "require one-word
output"). The more signals your prompt covers, the more — and harder — golden
cases pass. A live checklist in the UI shows your coverage; save a baseline,
weaken the prompt, and the gate catches the regression.

## How the backend works

The dashboard is **self-contained**: it ships its own eval engine as Next.js API
route handlers (`app/api/*`), so it runs everything (run / baseline / gate) with no
separate service. `lib/engine.ts` scores a prompt against a golden set and reuses
the same aggregation + regression logic as the Python harness, so the gate behaves
identically.

The client calls **same-origin `/api`** by default. To instead point it at the
Python FastAPI backend (`../server/`) — e.g. to run the real library — set:

```
NEXT_PUBLIC_API_URL = http://localhost:8000
```

Leave it unset (the default) to use the built-in routes.

## Deploying to Vercel

Nothing extra required — the app is fully self-contained:

1. Import the repo into Vercel with **Root Directory = `web`**.
2. Deploy. No backend, env var, or CORS config needed.

The `run → save baseline → gate` flow works on serverless because the gate is
**stateless** (the browser holds the baseline and sends it with the request), and
run history is kept in the browser's `localStorage`.

> The `../server/` FastAPI backend remains for local/CLI use and for running the
> *real* Python harness; it is not needed for the hosted demo.

## Build

```bash
npm run build && npm start
```
