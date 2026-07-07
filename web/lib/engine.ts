// TypeScript port of the evalharness demo pipeline (run / scorers / regression),
// so the dashboard runs fully on Vercel with no Python backend. Mirrors the
// behavior of server/demo.py + evalharness/{runner,scorers,regression}.py.

import { createHash, randomUUID } from "node:crypto";
import type {
  AggregateMetrics,
  CaseResult,
  GateDecision,
  GateReason,
  RunResult,
  ScoreResult,
  SuiteSummary,
} from "./types";
import type { SuiteCaseDef, SuiteDef } from "./suites";

const WRONG_FALLBACK = "I'm not certain about this one.";

// ---- demo provider: answer the golden set at a given quality ----------------

function isDegraded(caseId: string, quality: number): boolean {
  if (quality >= 1.0) return false;
  if (quality <= 0.0) return true;
  const digest = createHash("sha256").update(caseId).digest("hex");
  const bucket = parseInt(digest.slice(0, 8), 16) / 0xffffffff; // 0..1
  return bucket >= quality;
}

function demoAnswer(c: SuiteCaseDef, quality: number): string {
  if (!isDegraded(c.id, quality)) return c.expected;
  return c.distractor || WRONG_FALLBACK;
}

// ---- scorers ----------------------------------------------------------------

const norm = (s: string) => s.trim().toLowerCase();

function scoreContains(expected: string, output: string, threshold: number): ScoreResult {
  const hit = norm(output).includes(norm(expected));
  const score = hit ? 1.0 : 0.0;
  return {
    scorer: "contains",
    score,
    passed: score >= threshold,
    detail: hit ? "contains expected" : "missing expected",
  };
}

// Simulated LLM judge: grades pass/high when the expected answer is present.
function scoreJudge(expected: string, output: string, threshold: number): ScoreResult {
  const good = norm(output).includes(norm(expected));
  const score = good ? 0.95 : 0.15;
  return {
    scorer: "llm_judge",
    score,
    passed: score >= threshold,
    detail: good ? "Matches the expected answer." : "Does not satisfy the criteria.",
  };
}

// ---- run --------------------------------------------------------------------

export function runSuite(suite: SuiteDef, quality: number): RunResult {
  const cases: CaseResult[] = suite.cases.map((c) => {
    const output = demoAnswer(c, quality);
    const scores: ScoreResult[] = suite.scorers.map((spec) =>
      spec.type === "contains"
        ? scoreContains(c.expected, output, spec.threshold)
        : scoreJudge(c.expected, output, spec.threshold),
    );
    // A case passes iff every REQUIRED scorer passes (or all, if none required).
    const required = suite.scorers.filter((s) => s.required).map((s) => s.type as string);
    const gateSet = new Set<string>(
      required.length ? required : suite.scorers.map((s) => s.type as string),
    );
    const passed = scores.length > 0 && scores.every((s) => !gateSet.has(s.scorer) || s.passed);
    return {
      case_id: c.id,
      input: c.input,
      output,
      scores,
      passed,
      error: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  });

  return {
    suite: suite.name,
    target_model: suite.target_model,
    cases,
    metrics: aggregate(cases),
    created_at: new Date().toISOString(),
  };
}

function aggregate(cases: CaseResult[]): AggregateMetrics {
  const total = cases.length;
  const passed = cases.filter((c) => c.passed).length;

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const c of cases) {
    for (const s of c.scores) {
      sums[s.scorer] = (sums[s.scorer] ?? 0) + s.score;
      counts[s.scorer] = (counts[s.scorer] ?? 0) + 1;
    }
  }
  const mean_score_by_scorer: Record<string, number> = {};
  for (const name of Object.keys(sums)) {
    if (counts[name]) mean_score_by_scorer[name] = sums[name] / counts[name];
  }

  return {
    total,
    passed,
    pass_rate: total ? passed / total : 0,
    mean_score_by_scorer,
    input_tokens: 0,
    output_tokens: 0,
    est_cost_usd: 0,
  };
}

// ---- regression -------------------------------------------------------------

export function compare(
  current: RunResult,
  baseline: RunResult,
  thresholds: { pass_rate_drop: number; scorer_mean_drop: number },
): GateDecision {
  const reasons: GateReason[] = [];
  const baseById = new Map(baseline.cases.map((c) => [c.case_id, c]));

  for (const cur of current.cases) {
    const prev = baseById.get(cur.case_id);
    if (prev && prev.passed && !cur.passed) {
      const failing = cur.error || firstFailing(cur);
      reasons.push({
        kind: "case_regression",
        detail: `case '${cur.case_id}' regressed pass -> fail (${failing})`,
      });
    }
  }

  const drop = baseline.metrics.pass_rate - current.metrics.pass_rate;
  if (drop > thresholds.pass_rate_drop) {
    reasons.push({
      kind: "pass_rate_drop",
      detail: `pass rate dropped ${fmtPct(baseline.metrics.pass_rate)} -> ${fmtPct(
        current.metrics.pass_rate,
      )} (delta ${fmtPct(drop)} > tolerance ${fmtPct(thresholds.pass_rate_drop)})`,
    });
  }

  for (const [scorer, baseMean] of Object.entries(baseline.metrics.mean_score_by_scorer)) {
    const curMean = current.metrics.mean_score_by_scorer[scorer];
    if (curMean == null) continue;
    const sdrop = baseMean - curMean;
    if (sdrop > thresholds.scorer_mean_drop) {
      reasons.push({
        kind: "scorer_drop",
        detail: `scorer '${scorer}' mean dropped ${baseMean.toFixed(3)} -> ${curMean.toFixed(
          3,
        )} (delta ${sdrop.toFixed(3)} > tolerance ${thresholds.scorer_mean_drop.toFixed(3)})`,
      });
    }
  }

  return { passed: reasons.length === 0, reasons };
}

function firstFailing(c: CaseResult): string {
  const f = c.scores.find((s) => !s.passed);
  return f ? `${f.scorer}: ${f.detail}` : "no passing scorers";
}

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

// ---- summaries --------------------------------------------------------------

export function suiteSummary(suite: SuiteDef, withCases = false): SuiteSummary {
  const summary: SuiteSummary = {
    name: suite.name,
    provider: "demo",
    target_model: suite.target_model,
    judge_model: suite.judge_model,
    prompt_template: suite.prompt_template,
    scorers: suite.scorers.map((s) => ({
      type: s.type,
      threshold: s.threshold,
      required: s.required,
    })),
    num_cases: suite.cases.length,
    golden_set: suite.golden_set,
    thresholds: suite.thresholds,
  };
  if (withCases) {
    summary.cases = suite.cases.map((c) => ({
      id: c.id,
      input: c.input,
      expected: c.expected,
      rubric: c.rubric,
      tags: c.tags ?? [],
    }));
  }
  return summary;
}

export function newId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}
