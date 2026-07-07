"""Filesystem persistence for runs and baselines.

Runs and baselines are stored as JSON under a data directory, so the dashboard
has history across restarts. Ids are content-independent random hex.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from evalharness.models import Baseline, RunResult


class RunStore:
    def __init__(self, root: str = ".data") -> None:
        self.root = Path(root)
        self.runs_dir = self.root / "runs"
        self.baselines_dir = self.root / "baselines"
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        self.baselines_dir.mkdir(parents=True, exist_ok=True)

    # ---- runs -----------------------------------------------------------

    def save_run(self, run: RunResult, *, suite: str, quality: float, mode: str) -> dict:
        run_id = uuid.uuid4().hex[:12]
        record = {
            "id": run_id,
            "suite": suite,
            "quality": quality,
            "mode": mode,
            "run": run.model_dump(),
        }
        (self.runs_dir / f"{run_id}.json").write_text(
            json.dumps(record, indent=2), encoding="utf-8"
        )
        return record

    def list_runs(self) -> list[dict]:
        records = []
        for f in self.runs_dir.glob("*.json"):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            run = data.get("run", {})
            metrics = run.get("metrics", {})
            records.append(
                {
                    "id": data["id"],
                    "suite": data.get("suite"),
                    "quality": data.get("quality"),
                    "mode": data.get("mode"),
                    "created_at": run.get("created_at"),
                    "pass_rate": metrics.get("pass_rate"),
                    "passed": metrics.get("passed"),
                    "total": metrics.get("total"),
                    "est_cost_usd": metrics.get("est_cost_usd"),
                }
            )
        records.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        return records

    def get_run(self, run_id: str) -> dict | None:
        f = self.runs_dir / f"{run_id}.json"
        if not f.exists():
            return None
        return json.loads(f.read_text(encoding="utf-8"))

    # ---- baselines ------------------------------------------------------

    def save_baseline(self, baseline: Baseline, *, suite: str) -> dict:
        bl_id = uuid.uuid4().hex[:12]
        record = {"id": bl_id, "suite": suite, "baseline": baseline.model_dump()}
        (self.baselines_dir / f"{bl_id}.json").write_text(
            json.dumps(record, indent=2), encoding="utf-8"
        )
        return record

    def list_baselines(self) -> list[dict]:
        out = []
        for f in self.baselines_dir.glob("*.json"):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            run = data.get("baseline", {}).get("run", {})
            out.append(
                {
                    "id": data["id"],
                    "suite": data.get("suite"),
                    "created_at": run.get("created_at"),
                    "pass_rate": run.get("metrics", {}).get("pass_rate"),
                }
            )
        out.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        return out

    def get_baseline(self, bl_id: str) -> Baseline | None:
        f = self.baselines_dir / f"{bl_id}.json"
        if not f.exists():
            return None
        data = json.loads(f.read_text(encoding="utf-8"))
        return Baseline.model_validate(data["baseline"])

    def latest_baseline_for(self, suite: str) -> Baseline | None:
        candidates = [b for b in self.list_baselines() if b["suite"] == suite]
        if not candidates:
            return None
        return self.get_baseline(candidates[0]["id"])
