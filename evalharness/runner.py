"""Runner: orchestrate the evaluation pipeline into a RunResult.

For each case: render the prompt, call the provider (through the cache), run
every scorer, and combine into a CaseResult. Per-case errors are isolated so a
single failure never aborts the run. See ``docs/LLD.md`` §8.

Dependencies are injected (provider, cache, scorers, aggregator) and referenced
through their abstractions — the runner does not construct or import concrete
providers/scorers itself (Dependency Inversion).
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from evalharness.aggregation import MetricsAggregator
from evalharness.cache import Cache
from evalharness.config import SuiteConfig
from evalharness.log import get_logger
from evalharness.models import (
    CaseResult,
    GoldenSet,
    ProviderResponse,
    RunResult,
    ScoreResult,
    TestCase,
    Usage,
)
from evalharness.providers.base import Provider
from evalharness.scorers.base import Scorer

_log = get_logger(__name__)


class Runner:
    def __init__(
        self,
        config: SuiteConfig,
        provider: Provider,
        cache: Cache,
        scorers: list[Scorer],
        *,
        now: str,
        aggregator: MetricsAggregator | None = None,
    ) -> None:
        self.config = config
        self.provider = provider
        self.cache = cache
        self.scorers = scorers
        self.now = now
        self.aggregator = aggregator or MetricsAggregator(provider.cost)

    # ---- provider call with caching -------------------------------------

    def _complete(self, prompt: str, model: str) -> ProviderResponse:
        params = {"max_tokens": self.config.max_tokens}
        key = self.cache.key(self.provider.name, model, prompt, self.config.system, params)
        hit = self.cache.get(key)
        if hit is not None:
            return hit
        resp = self.provider.complete(
            prompt,
            model=model,
            max_tokens=self.config.max_tokens,
            system=self.config.system,
        )
        self.cache.put(key, resp)
        return resp

    # ---- per-case evaluation --------------------------------------------

    def _run_case(self, case: TestCase) -> CaseResult:
        prompt = self.config.prompt_template.format(input=case.input)
        try:
            resp = self._complete(prompt, self.config.target_model)
        except Exception as exc:  # provider failure — record, don't crash
            _log.error("case %r failed: %s", case.id, exc)
            return CaseResult(
                case_id=case.id,
                input=case.input,
                output="",
                scores=[],
                passed=False,
                error=f"provider error: {exc}",
            )

        scores: list[ScoreResult] = []
        for scorer in self.scorers:
            try:
                scores.append(scorer.score(case, resp.text))
            except Exception as exc:  # a broken scorer becomes a failing score
                _log.warning("scorer %r errored on case %r: %s", getattr(scorer, "name", "?"), case.id, exc)
                scores.append(
                    ScoreResult(
                        scorer=getattr(scorer, "name", "unknown"),
                        score=0.0,
                        passed=False,
                        detail=f"scorer error: {exc}",
                    )
                )

        # A case passes iff every REQUIRED scorer passes. If no scorer is marked
        # required, all scorers must pass.
        required = [s for s in self.scorers if getattr(s, "required", False)]
        gate_scorers = {s.name for s in (required or self.scorers)}
        passed = all(sr.passed for sr in scores if sr.scorer in gate_scorers) and bool(scores)

        # Track target-model usage only for freshly generated (uncached) output.
        case_usage = Usage() if resp.cached else resp.usage
        _log.debug("case %r -> %s", case.id, "PASS" if passed else "FAIL")
        return CaseResult(
            case_id=case.id,
            input=case.input,
            output=resp.text,
            scores=scores,
            passed=passed,
            usage=case_usage,
        )

    # ---- whole-suite run -------------------------------------------------

    def run(self, golden: GoldenSet) -> RunResult:
        _log.info(
            "running suite %r: %d cases, model=%s, concurrency=%d",
            self.config.name,
            len(golden.cases),
            self.config.target_model,
            self.config.concurrency,
        )
        workers = max(1, self.config.concurrency)
        if workers == 1:
            results = [self._run_case(c) for c in golden.cases]
        else:
            with ThreadPoolExecutor(max_workers=workers) as pool:
                results = list(pool.map(self._run_case, golden.cases))

        metrics = self.aggregator.aggregate(self.config.target_model, results)
        _log.info(
            "suite %r done: pass_rate=%.1f%% cost=$%.4f",
            self.config.name,
            metrics.pass_rate * 100,
            metrics.est_cost_usd,
        )
        return RunResult(
            suite=self.config.name,
            target_model=self.config.target_model,
            cases=results,
            metrics=metrics,
            created_at=self.now,
        )
