// Suite + golden-set definitions, ported from server/suites/*.yaml.
// Kept as data so the Next.js API routes can run the demo without the Python backend.

export interface SuiteCaseDef {
  id: string;
  input: string;
  expected: string;
  rubric: string;
  tags?: string[];
  distractor: string; // wrong-but-plausible answer used when degraded
}

export interface ScorerDef {
  type: "contains" | "llm_judge";
  threshold: number;
  required: boolean;
}

export interface SuiteDef {
  name: string;
  target_model: string;
  judge_model: string;
  prompt_template: string;
  scorers: ScorerDef[];
  thresholds: { pass_rate_drop: number; scorer_mean_drop: number };
  golden_set: string;
  cases: SuiteCaseDef[];
}

const DEFAULT_SCORERS: ScorerDef[] = [
  { type: "contains", threshold: 1.0, required: true },
  { type: "llm_judge", threshold: 0.6, required: false },
];

const DEFAULT_THRESHOLDS = { pass_rate_drop: 0.0, scorer_mean_drop: 0.05 };

export const SUITES: SuiteDef[] = [
  {
    name: "capitals-qa",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    prompt_template: "{input}",
    scorers: DEFAULT_SCORERS,
    thresholds: DEFAULT_THRESHOLDS,
    golden_set: "capitals-qa",
    cases: [
      { id: "france", input: "What is the capital of France?", expected: "Paris", rubric: "Correctly identifies Paris.", tags: ["geography"], distractor: "London" },
      { id: "japan", input: "What is the capital of Japan?", expected: "Tokyo", rubric: "Correctly identifies Tokyo.", tags: ["geography"], distractor: "Kyoto" },
      { id: "australia", input: "What is the capital of Australia?", expected: "Canberra", rubric: "Identifies Canberra, not Sydney.", tags: ["geography", "tricky"], distractor: "Sydney" },
      { id: "brazil", input: "What is the capital of Brazil?", expected: "Brasília", rubric: "Identifies Brasília, not Rio.", tags: ["geography", "tricky"], distractor: "Rio de Janeiro" },
      { id: "egypt", input: "What is the capital of Egypt?", expected: "Cairo", rubric: "Correctly identifies Cairo.", tags: ["geography"], distractor: "Alexandria" },
      { id: "canada", input: "What is the capital of Canada?", expected: "Ottawa", rubric: "Identifies Ottawa, not Toronto.", tags: ["geography", "tricky"], distractor: "Toronto" },
      { id: "norway", input: "What is the capital of Norway?", expected: "Oslo", rubric: "Correctly identifies Oslo.", tags: ["geography"], distractor: "Bergen" },
      { id: "kenya", input: "What is the capital of Kenya?", expected: "Nairobi", rubric: "Correctly identifies Nairobi.", tags: ["geography"], distractor: "Mombasa" },
    ],
  },
  {
    name: "sentiment-classification",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    prompt_template:
      "Classify the sentiment of this text as positive, negative, or neutral:\n{input}",
    scorers: DEFAULT_SCORERS,
    thresholds: DEFAULT_THRESHOLDS,
    golden_set: "sentiment-classification",
    cases: [
      { id: "s1", input: "The product quality is excellent and shipping was fast!", expected: "positive", rubric: "Classifies as positive.", distractor: "negative" },
      { id: "s2", input: "Terrible customer service, I will never buy again.", expected: "negative", rubric: "Classifies as negative.", distractor: "positive" },
      { id: "s3", input: "It's okay, nothing special but it works.", expected: "neutral", rubric: "Classifies as neutral.", distractor: "positive" },
      { id: "s4", input: "Absolutely love it, best purchase this year.", expected: "positive", rubric: "Classifies as positive.", distractor: "neutral" },
      { id: "s5", input: "The package arrived damaged and support ignored my emails.", expected: "negative", rubric: "Classifies as negative.", distractor: "neutral" },
      { id: "s6", input: "Does what it says. No complaints, no surprises.", expected: "neutral", rubric: "Classifies as neutral.", distractor: "negative" },
    ],
  },
];

export function getSuite(name: string): SuiteDef | undefined {
  return SUITES.find((s) => s.name === name);
}
