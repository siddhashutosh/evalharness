// TypeScript mirror of the evalharness data model (see the Python `models.py`).

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface ScoreResult {
  scorer: string;
  score: number;
  passed: boolean;
  detail: string;
}

export interface CaseResult {
  case_id: string;
  input: string;
  output: string;
  scores: ScoreResult[];
  passed: boolean;
  error: string | null;
  usage: Usage;
}

export interface AggregateMetrics {
  total: number;
  passed: number;
  pass_rate: number;
  mean_score_by_scorer: Record<string, number>;
  input_tokens: number;
  output_tokens: number;
  est_cost_usd: number;
}

export interface RunResult {
  suite: string;
  target_model: string;
  cases: CaseResult[];
  metrics: AggregateMetrics;
  created_at: string;
}

export type GateReasonKind = "case_regression" | "pass_rate_drop" | "scorer_drop";

export interface GateReason {
  kind: GateReasonKind;
  detail: string;
}

export interface GateDecision {
  passed: boolean;
  reasons: GateReason[];
}

export interface ScorerSpec {
  type: string;
  threshold: number;
  required: boolean;
}

export interface SuiteSummary {
  name: string;
  provider: string;
  target_model: string;
  judge_model: string;
  prompt_template: string;
  scorers: ScorerSpec[];
  num_cases: number;
  golden_set: string;
  thresholds: { pass_rate_drop: number; scorer_mean_drop: number };
  cases?: SuiteCase[];
}

export interface SuiteCase {
  id: string;
  input: string;
  expected: string | null;
  rubric: string | null;
  tags: string[];
}

export interface RunSummary {
  id: string;
  suite: string;
  quality: number;
  mode: string;
  created_at: string;
  pass_rate: number;
  passed: number;
  total: number;
  est_cost_usd: number;
}

export interface GateResponse {
  run: RunResult;
  gate: GateDecision | null;
  baseline?: unknown;
  run_id?: string;
  error?: string;
}
