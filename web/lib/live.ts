// Live eval engine — "bring your own key". For each golden case it calls the
// real Claude model to produce an answer, then a second call grades that answer
// against the case rubric (LLM-as-judge). The key is used per request and never
// stored or logged here.

import Anthropic from "@anthropic-ai/sdk";
import type { AggregateMetrics, CaseResult, RunResult, ScoreResult } from "./types";
import type { SuiteDef } from "./suites";
import { runWithPrompt } from "./engine";
import { DEFAULT_LIVE_MODEL as DEFAULT_MODEL } from "./models";

// USD per 1M tokens (input, output).
const PRICES: Record<string, [number, number]> = {
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [3, 15],
  "claude-haiku-4-5": [1, 5],
};

type Usage = { input_tokens: number; output_tokens: number };

function costOf(model: string, u: Usage): number {
  const [pin, pout] = PRICES[model] ?? [3, 15];
  return (u.input_tokens / 1e6) * pin + (u.output_tokens / 1e6) * pout;
}

const JUDGE_SYSTEM =
  "You are a strict, fair evaluator. Grade the ANSWER against the CRITERIA. " +
  "Return a calibrated score in [0,1], a boolean pass, and one sentence of reasoning. " +
  "Do not reward answers that ignore the criteria.";

function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function generate(
  client: Anthropic,
  model: string,
  system: string,
  input: string,
): Promise<{ text: string; usage: Usage }> {
  const msg = await client.messages.create({
    model,
    max_tokens: 400,
    system: system || undefined,
    messages: [{ role: "user", content: input }],
  });
  return {
    text: textOf(msg),
    usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
  };
}

async function judge(
  client: Anthropic,
  model: string,
  input: string,
  output: string,
  criteria: string,
): Promise<{ score: number; passed: boolean; reasoning: string; usage: Usage }> {
  const prompt =
    "You are grading an assistant's answer.\n\n" +
    `QUESTION:\n${input}\n\n` +
    `CRITERIA (what a good answer must satisfy):\n${criteria}\n\n` +
    `ANSWER TO GRADE:\n${output}\n\n` +
    'Respond with ONLY a JSON object: {"score": <float 0..1>, "pass": <true|false>, "reasoning": "<one sentence>"}';
  const msg = await client.messages.create({
    model,
    max_tokens: 200,
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const usage = { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens };
  const v = parseVerdict(textOf(msg));
  return { score: v.score, passed: v.score >= 0.6, reasoning: v.reasoning, usage };
}

function parseVerdict(text: string): { score: number; reasoning: string } {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  const raw = s !== -1 && e !== -1 && e > s ? text.slice(s, e + 1) : text;
  try {
    const o = JSON.parse(raw);
    const score = Math.max(0, Math.min(1, Number(o.score)));
    return {
      score: Number.isFinite(score) ? score : 0,
      reasoning: String(o.reasoning ?? "").slice(0, 300),
    };
  } catch {
    return { score: 0, reasoning: "Could not parse the judge's verdict." };
  }
}

export async function liveRun(
  suite: SuiteDef,
  prompt: string,
  model: string,
  apiKey: string,
): Promise<RunResult> {
  const client = new Anthropic({ apiKey });
  const usedModel = model || DEFAULT_MODEL;

  const cases: CaseResult[] = await Promise.all(
    suite.cases.map(async (c): Promise<CaseResult> => {
      try {
        const gen = await generate(client, usedModel, prompt, c.input);
        const v = await judge(client, usedModel, c.input, gen.text, c.rubric || c.expected);
        const score: ScoreResult = {
          scorer: "llm_judge",
          score: v.score,
          passed: v.passed,
          detail: v.reasoning,
        };
        return {
          case_id: c.id,
          input: c.input,
          output: gen.text,
          scores: [score],
          passed: v.passed,
          error: null,
          usage: {
            input_tokens: gen.usage.input_tokens + v.usage.input_tokens,
            output_tokens: gen.usage.output_tokens + v.usage.output_tokens,
          },
        };
      } catch (err) {
        // A bad key / no access is fatal — fail the whole run with one clear
        // message instead of the same error on every case.
        if (err instanceof Anthropic.APIError && (err.status === 401 || err.status === 403)) {
          throw err;
        }
        return {
          case_id: c.id,
          input: c.input,
          output: "",
          scores: [],
          passed: false,
          error: `model error: ${errMsg(err)}`,
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      }
    }),
  );

  return {
    suite: suite.name,
    target_model: usedModel,
    cases,
    metrics: aggregate(cases, usedModel),
    created_at: new Date().toISOString(),
  };
}

function aggregate(cases: CaseResult[], model: string): AggregateMetrics {
  const total = cases.length;
  const passed = cases.filter((c) => c.passed).length;
  let sum = 0;
  let count = 0;
  const usage: Usage = { input_tokens: 0, output_tokens: 0 };
  for (const c of cases) {
    for (const s of c.scores) {
      sum += s.score;
      count += 1;
    }
    usage.input_tokens += c.usage.input_tokens;
    usage.output_tokens += c.usage.output_tokens;
  }
  return {
    total,
    passed,
    pass_rate: total ? passed / total : 0,
    mean_score_by_scorer: count ? { llm_judge: sum / count } : {},
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    est_cost_usd: Number(costOf(model, usage).toFixed(6)),
  };
}

// Dispatch: demo (deterministic, offline) or live (real Claude calls).
export async function evaluate(
  suite: SuiteDef,
  prompt: string,
  mode: string,
  model: string | undefined,
  apiKey: string | null,
): Promise<RunResult> {
  if (mode === "live") {
    if (!apiKey) throw new LiveKeyError("An Anthropic API key is required for live mode.");
    return liveRun(suite, prompt, model || DEFAULT_MODEL, apiKey);
  }
  return runWithPrompt(suite, prompt);
}

export class LiveKeyError extends Error {}

export function errMsg(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 401) return "Invalid API key.";
    if (err.status === 429) return "Rate limited by Anthropic — try again shortly.";
    return err.message || `Anthropic error ${err.status}`;
  }
  return err instanceof Error ? err.message : String(err);
}
