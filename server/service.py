"""Service layer: bridges HTTP requests to the evalharness library.

Discovers suite configs, runs the harness (demo provider by default, real
provider in ``live`` mode), and persists results via the store.
"""

from __future__ import annotations

import datetime as _dt
from pathlib import Path

from evalharness.cache import NullCache
from evalharness.config import SuiteConfig, load_suite
from evalharness.dataset import load_golden_set
from evalharness.errors import EvalHarnessError
from evalharness.models import Baseline, GoldenSet, RunResult
from evalharness.providers import get_provider
from evalharness.regression import compare
from evalharness.runner import Runner
from evalharness.scorers import build_scorers

from server.demo import build_demo_provider
from server.store import RunStore

_SUITES_DIR = Path(__file__).parent / "suites"


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


class Service:
    def __init__(self, store: RunStore | None = None) -> None:
        self.store = store or RunStore(str(Path(__file__).parent / ".data"))

    # ---- suites ---------------------------------------------------------

    def _suite_paths(self) -> dict[str, Path]:
        paths: dict[str, Path] = {}
        for f in sorted(_SUITES_DIR.glob("*.yaml")):
            try:
                cfg = load_suite(str(f))
            except EvalHarnessError:
                continue
            paths[cfg.name] = f
        return paths

    def list_suites(self) -> list[dict]:
        out = []
        for name, path in self._suite_paths().items():
            cfg = load_suite(str(path))
            golden = load_golden_set(cfg.golden_set_path())
            out.append(self._suite_summary(cfg, golden))
        return out

    def get_suite(self, name: str) -> dict:
        cfg, golden = self._load(name)
        summary = self._suite_summary(cfg, golden)
        summary["cases"] = [
            {
                "id": c.id,
                "input": c.input,
                "expected": c.expected,
                "rubric": c.rubric,
                "tags": c.tags,
            }
            for c in golden.cases
        ]
        return summary

    @staticmethod
    def _suite_summary(cfg: SuiteConfig, golden: GoldenSet) -> dict:
        return {
            "name": cfg.name,
            "provider": cfg.provider,
            "target_model": cfg.target_model,
            "judge_model": cfg.judge_model,
            "prompt_template": cfg.prompt_template,
            "scorers": [
                {"type": s.type, "threshold": s.threshold, "required": s.required}
                for s in cfg.scorers
            ],
            "num_cases": len(golden.cases),
            "golden_set": golden.name,
            "thresholds": {
                "pass_rate_drop": cfg.thresholds.pass_rate_drop,
                "scorer_mean_drop": cfg.thresholds.scorer_mean_drop,
            },
        }

    def _load(self, name: str) -> tuple[SuiteConfig, GoldenSet]:
        paths = self._suite_paths()
        if name not in paths:
            raise KeyError(name)
        cfg = load_suite(str(paths[name]))
        golden = load_golden_set(cfg.golden_set_path())
        return cfg, golden

    # ---- running --------------------------------------------------------

    def _run(self, name: str, quality: float, mode: str) -> tuple[SuiteConfig, RunResult]:
        cfg, golden = self._load(name)
        if mode == "live":
            provider = get_provider(cfg.provider)
        else:
            provider = build_demo_provider(golden, quality)
        scorers = build_scorers(cfg.scorers, provider=provider, judge_model=cfg.judge_model)
        # Demo runs skip the cache so the quality slider always re-evaluates.
        runner = Runner(cfg, provider, NullCache(), scorers, now=_now())
        return cfg, runner.run(golden)

    def run_suite(self, name: str, quality: float, mode: str) -> dict:
        _cfg, run = self._run(name, quality, mode)
        return self.store.save_run(run, suite=name, quality=quality, mode=mode)

    def save_baseline(self, name: str, quality: float, mode: str) -> dict:
        _cfg, run = self._run(name, quality, mode)
        record = self.store.save_baseline(Baseline(run=run), suite=name)
        record["run"] = run.model_dump()
        return record

    def gate(self, name: str, quality: float, mode: str, baseline_id: str | None) -> dict:
        cfg, run = self._run(name, quality, mode)
        baseline = (
            self.store.get_baseline(baseline_id)
            if baseline_id
            else self.store.latest_baseline_for(name)
        )
        if baseline is None:
            return {
                "run": run.model_dump(),
                "gate": None,
                "error": "no baseline found for this suite — save one first",
            }
        decision = compare(run, baseline, cfg.thresholds)
        record = self.store.save_run(run, suite=name, quality=quality, mode=mode)
        return {
            "run": run.model_dump(),
            "gate": decision.model_dump(),
            "baseline": baseline.model_dump(),
            "run_id": record["id"],
        }
