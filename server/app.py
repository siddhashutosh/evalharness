"""FastAPI application exposing the evalharness library to the dashboard.

Endpoints
    GET  /api/health
    GET  /api/suites
    GET  /api/suites/{name}
    POST /api/run          {suite, quality, mode}
    POST /api/baseline     {suite, quality, mode}
    POST /api/gate         {suite, quality, mode, baseline_id?}
    GET  /api/runs
    GET  /api/runs/{id}
    GET  /api/baselines
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from evalharness.errors import EvalHarnessError
from evalharness.log import configure
from server.service import Service

configure("info")

app = FastAPI(title="evalharness API", version="1.0.0")

# The Next.js dev server runs on a different origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

service = Service()


class RunRequest(BaseModel):
    suite: str
    quality: float = Field(default=1.0, ge=0.0, le=1.0)
    mode: str = "demo"  # "demo" | "live"


class GateRequest(RunRequest):
    baseline_id: str | None = None


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "evalharness"}


@app.get("/api/suites")
def list_suites() -> list[dict]:
    return service.list_suites()


@app.get("/api/suites/{name}")
def get_suite(name: str) -> dict:
    try:
        return service.get_suite(name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"suite not found: {name}")
    except EvalHarnessError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/run")
def run(req: RunRequest) -> dict:
    return _guard(lambda: service.run_suite(req.suite, req.quality, req.mode))


@app.post("/api/baseline")
def baseline(req: RunRequest) -> dict:
    return _guard(lambda: service.save_baseline(req.suite, req.quality, req.mode))


@app.post("/api/gate")
def gate(req: GateRequest) -> dict:
    return _guard(lambda: service.gate(req.suite, req.quality, req.mode, req.baseline_id))


@app.get("/api/runs")
def list_runs() -> list[dict]:
    return service.store.list_runs()


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> dict:
    rec = service.store.get_run(run_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"run not found: {run_id}")
    return rec


@app.get("/api/baselines")
def list_baselines() -> list[dict]:
    return service.store.list_baselines()


def _guard(fn):
    try:
        return fn()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"suite not found: {exc}")
    except EvalHarnessError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
