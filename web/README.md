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

## Configuration

`NEXT_PUBLIC_API_URL` — backend base URL (default `http://localhost:8000`).

## Deploying (Vercel + a hosted backend)

The frontend and backend deploy **separately**: Vercel hosts this Next.js app;
the FastAPI backend (`../server/`) runs on a Python host. The browser calls the
backend directly, so it must be publicly reachable — `localhost` will not work
once hosted.

**1. Deploy the backend** (demo mode needs no API key). Any Python host works;
the repo ships config for two:

- **Render** — `render.yaml` at the repo root. New Web Service → point at this
  repo → it builds and serves `uvicorn server.app:app`. Copy the resulting URL.
- **Docker** (Railway / Fly.io / Cloud Run) — `Dockerfile` at the repo root:
  `docker build -t evalharness-api . && docker run -p 8000:8000 evalharness-api`.

Verify it's up: `https://<your-backend>/api/health` → `{"status":"ok"}`.

**2. Point Vercel at it.** In the Vercel project → **Settings → Environment
Variables**, add:

```
NEXT_PUBLIC_API_URL = https://<your-backend-url>
```

**3. Redeploy.** `NEXT_PUBLIC_*` vars are baked in at **build time**, so you must
trigger a new deployment after setting it (Deployments → ⋯ → Redeploy, or push a
commit). CORS on the backend is already open, so no extra config is needed.

> Note: the free Render tier sleeps when idle, so the first request after a pause
> takes a few seconds to wake the service.

## Build

```bash
npm run build && npm start
```
