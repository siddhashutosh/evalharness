// 10 AI-feature templates, each with a golden set and prompt-engineering signals.
//
// The dashboard is a prompt playground: you pick a feature, edit its system
// prompt, and the demo engine scores how well that prompt would do against the
// golden set. A "signal" is a good-prompt quality (e.g. "list the allowed
// labels"); the more signals your prompt covers, the more (and harder) cases
// pass. See lib/engine.ts for the scoring.

export interface PromptSignal {
  text: string; // lowercased substring that indicates the quality is present
  tip: string; // human-readable prompt tip
}

export interface SuiteCaseDef {
  id: string;
  input: string;
  expected: string; // a correct answer contains this
  rubric: string;
  distractor: string; // a wrong-but-plausible answer (never contains `expected`)
  difficulty: number; // prompt score needed for this case to pass (0..1)
}

export interface ScorerDef {
  type: "contains" | "llm_judge";
  threshold: number;
  required: boolean;
}

export interface SuiteDef {
  name: string;
  label: string;
  description: string;
  target_model: string;
  judge_model: string;
  scorers: ScorerDef[];
  thresholds: { pass_rate_drop: number; scorer_mean_drop: number };
  golden_set: string;
  default_prompt: string; // a strong starting prompt (covers all signals)
  weak_prompt: string; // a lazy prompt (covers none) — used by the failing demo
  signals: PromptSignal[];
  cases: SuiteCaseDef[];
}

const DS: ScorerDef[] = [
  { type: "contains", threshold: 1.0, required: true },
  { type: "llm_judge", threshold: 0.6, required: false },
];
const DT = { pass_rate_drop: 0.0, scorer_mean_drop: 0.05 };
const D = [0.2, 0.45, 0.7, 0.9]; // difficulty tiers (easy → hard)

export const SUITES: SuiteDef[] = [
  {
    name: "support-bot",
    label: "Customer support assistant",
    description: "Answers customer questions accurately without inventing policy.",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "support-bot",
    default_prompt:
      "You are Acme's customer support assistant. Be concise and factual. Refunds are available within 30 days of purchase. Subscriptions are managed under account Settings. If you are unsure, say so instead of inventing a policy.",
    weak_prompt: "Just answer the customer's question as best you can.",
    signals: [
      { text: "concise", tip: "Ask for concise, factual answers" },
      { text: "30 day", tip: "State the 30-day refund window" },
      { text: "settings", tip: "Point users to account Settings" },
      { text: "unsure", tip: "Tell it to admit uncertainty, not invent policy" },
    ],
    cases: [
      { id: "greeting", input: "Hi, are you there?", expected: "How can I help you today?", rubric: "Greets and offers help.", distractor: "Please hold for an agent.", difficulty: D[0] },
      { id: "refund", input: "How do I get a refund?", expected: "Refunds are available within 30 days of purchase.", rubric: "States the 30-day window.", distractor: "Unfortunately we don't offer refunds.", difficulty: D[1] },
      { id: "cancel", input: "Where do I cancel my subscription?", expected: "You can cancel anytime under account Settings.", rubric: "Directs to Settings.", distractor: "Call our hotline to cancel.", difficulty: D[2] },
      { id: "invent", input: "Do you offer a lifetime warranty?", expected: "I'm not sure — let me check rather than guess.", rubric: "Admits uncertainty.", distractor: "Yes, every product has a lifetime warranty.", difficulty: D[3] },
    ],
  },
  {
    name: "sentiment",
    label: "Sentiment classifier",
    description: "Labels text as positive, negative, or neutral.",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "sentiment",
    default_prompt:
      "Classify the sentiment as exactly one word — positive, negative, or neutral. Output only the label in lowercase, with no explanation.",
    weak_prompt: "Tell me the overall sentiment of the message.",
    signals: [
      { text: "one word", tip: "Require a single-word answer" },
      { text: "positive, negative", tip: "List the allowed labels" },
      { text: "only the label", tip: "Forbid explanations" },
      { text: "lowercase", tip: "Fix the output casing" },
    ],
    cases: [
      { id: "s1", input: "This is the best purchase I've made all year!", expected: "positive", rubric: "Positive.", distractor: "negative", difficulty: D[0] },
      { id: "s2", input: "Awful quality and it broke on day one.", expected: "negative", rubric: "Negative.", distractor: "positive", difficulty: D[1] },
      { id: "s3", input: "It's fine. Does the job, nothing more.", expected: "neutral", rubric: "Neutral.", distractor: "positive", difficulty: D[2] },
      { id: "s4", input: "Oh great, another update that breaks everything.", expected: "negative", rubric: "Negative (sarcasm).", distractor: "positive", difficulty: D[3] },
    ],
  },
  {
    name: "summarizer",
    label: "Article summarizer",
    description: "Condenses text to key facts without adding opinions.",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "summarizer",
    default_prompt:
      "Summarize in 1-2 sentences. Keep the key facts and numbers, omit opinions, and do not add anything that is not in the source text.",
    weak_prompt: "Give me a short summary of the following text.",
    signals: [
      { text: "1-2 sentence", tip: "Bound the length (1-2 sentences)" },
      { text: "key facts", tip: "Require the key facts and numbers" },
      { text: "omit opinions", tip: "Exclude opinions" },
      { text: "not in the source", tip: "Forbid adding info not in the source" },
    ],
    cases: [
      { id: "sum1", input: "Q3 revenue rose 12% to $4.2M, driven by enterprise sales.", expected: "Revenue rose 12% to $4.2M.", rubric: "Keeps the number.", distractor: "The company had a disappointing quarter.", difficulty: D[0] },
      { id: "sum2", input: "The bridge, built in 1932, closes for 3 weeks of repairs from Monday.", expected: "The bridge closes for 3 weeks of repairs from Monday.", rubric: "Keeps the fact.", distractor: "The bridge will be demolished.", difficulty: D[1] },
      { id: "sum3", input: "A study of 500 patients found no link between the drug and the side effect.", expected: "A 500-patient study found no link.", rubric: "Preserves the finding.", distractor: "The drug causes the side effect.", difficulty: D[2] },
      { id: "sum4", input: "Profits fell 5%, though the CEO called the outlook 'incredibly exciting'.", expected: "Profits fell 5%.", rubric: "Omits the opinion.", distractor: "The outlook is incredibly exciting.", difficulty: D[3] },
    ],
  },
  {
    name: "email-drafter",
    label: "Email drafter",
    description: "Writes short, professional emails with the right structure.",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "email-drafter",
    default_prompt:
      "Draft a short, professional email. Include a clear subject line and a greeting, state the key message courteously, and end with a sign-off. Keep the tone professional.",
    weak_prompt: "Write an email about the topic below.",
    signals: [
      { text: "subject", tip: "Require a subject line" },
      { text: "greeting", tip: "Require a greeting" },
      { text: "sign-off", tip: "Require a sign-off" },
      { text: "professional", tip: "Set a professional tone" },
    ],
    cases: [
      { id: "e1", input: "Ask a client to move Tuesday's call to Thursday.", expected: "Subject: Rescheduling our call", rubric: "Has a subject line.", distractor: "hey can we move the call", difficulty: D[0] },
      { id: "e2", input: "Decline a vendor's proposal politely.", expected: "Thank you for the proposal; we've decided not to proceed.", rubric: "Polite decline.", distractor: "No thanks, not interested.", difficulty: D[1] },
      { id: "e3", input: "Remind a teammate about an overdue report.", expected: "Just a friendly reminder about the report due last Friday.", rubric: "Courteous reminder.", distractor: "You're late on the report again.", difficulty: D[2] },
      { id: "e4", input: "Apologize to a customer for a shipping delay.", expected: "We sincerely apologize for the delay and are making it right.", rubric: "Sincere apology.", distractor: "Your order is late, deal with it.", difficulty: D[3] },
    ],
  },
  {
    name: "intent",
    label: "Intent router",
    description: "Routes a request to one intent: billing, technical, sales, cancellation.",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "intent",
    default_prompt:
      "Classify the request into exactly one intent: billing, technical, sales, or cancellation. Output only the intent label in lowercase, and choose the single best match.",
    weak_prompt: "Figure out what the user wants and route them.",
    signals: [
      { text: "exactly one", tip: "Force a single intent" },
      { text: "billing, technical", tip: "List the allowed intents" },
      { text: "only the intent", tip: "Output the label only" },
      { text: "lowercase", tip: "Fix the casing" },
    ],
    cases: [
      { id: "i1", input: "My card was charged twice this month.", expected: "billing", rubric: "Billing.", distractor: "technical", difficulty: D[0] },
      { id: "i2", input: "The app crashes when I upload a file.", expected: "technical", rubric: "Technical.", distractor: "billing", difficulty: D[1] },
      { id: "i3", input: "Do you offer a plan for teams?", expected: "sales", rubric: "Sales.", distractor: "billing", difficulty: D[2] },
      { id: "i4", input: "I want to close my account for good.", expected: "cancellation", rubric: "Cancellation.", distractor: "technical", difficulty: D[3] },
    ],
  },
  {
    name: "pii-redactor",
    label: "PII redactor",
    description: "Replaces personal data with [REDACTED].",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "pii-redactor",
    default_prompt:
      "Redact all personally identifiable information — names, emails, and phone numbers — by replacing each with [REDACTED]. Keep all other text unchanged and do not miss any identifier.",
    weak_prompt: "Remove any private information from the text.",
    signals: [
      { text: "[redacted]", tip: "Specify the [REDACTED] placeholder" },
      { text: "email", tip: "Call out emails" },
      { text: "phone", tip: "Call out phone numbers" },
      { text: "names", tip: "Call out names" },
    ],
    cases: [
      { id: "p1", input: "Email me at john@acme.com", expected: "Email me at [REDACTED]", rubric: "Redacts email.", distractor: "Email me at john@acme.com", difficulty: D[0] },
      { id: "p2", input: "Call Sarah at 555-0142.", expected: "Call [REDACTED] at [REDACTED].", rubric: "Redacts name + phone.", distractor: "Call Sarah at 555-0142.", difficulty: D[1] },
      { id: "p3", input: "Ship to Bob, cc bob@x.io.", expected: "Ship to [REDACTED], cc [REDACTED].", rubric: "Redacts both.", distractor: "Ship to Bob, cc [REDACTED].", difficulty: D[2] },
      { id: "p4", input: "I'm Dr. A. Rivera, reach me at 555-0199.", expected: "I'm [REDACTED], reach me at [REDACTED].", rubric: "Redacts name + phone.", distractor: "I'm Dr. A. Rivera, reach me at [REDACTED].", difficulty: D[3] },
    ],
  },
  {
    name: "nl2sql",
    label: "Natural language → SQL",
    description: "Turns a question into a single valid SQL query.",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "nl2sql",
    default_prompt:
      "Convert the question into a single valid SQL query. Use only the given schema, return one statement, select only the needed columns, and end with a semicolon. Do not explain.",
    weak_prompt: "Turn the question into a database query.",
    signals: [
      { text: "sql", tip: "Say you want SQL" },
      { text: "schema", tip: "Constrain it to the given schema" },
      { text: "one statement", tip: "Require a single statement" },
      { text: "semicolon", tip: "Require a terminating semicolon" },
    ],
    cases: [
      { id: "q1", input: "How many users are there?", expected: "SELECT COUNT(*) FROM users;", rubric: "Counts rows.", distractor: "You can count the users table.", difficulty: D[0] },
      { id: "q2", input: "List active users' emails.", expected: "SELECT email FROM users WHERE active = true;", rubric: "Filters + selects one column.", distractor: "SELECT * FROM users;", difficulty: D[1] },
      { id: "q3", input: "Top 3 products by sales.", expected: "ORDER BY sales DESC LIMIT 3;", rubric: "Sorts + limits.", distractor: "Sort the products by sales somehow.", difficulty: D[2] },
      { id: "q4", input: "Users who never placed an order.", expected: "LEFT JOIN orders", rubric: "Uses an anti-join.", distractor: "SELECT * FROM users WHERE ordered = 0;", difficulty: D[3] },
    ],
  },
  {
    name: "translator",
    label: "Translator (English → French)",
    description: "Translates text into French, preserving names and tone.",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "translator",
    default_prompt:
      "Translate the text into French. Preserve the meaning and tone, keep names and numbers unchanged, and output only the translation with no notes.",
    weak_prompt: "Put this into another language for me.",
    signals: [
      { text: "french", tip: "Name the target language (French)" },
      { text: "tone", tip: "Preserve meaning and tone" },
      { text: "only the translation", tip: "Output the translation only" },
      { text: "names", tip: "Keep names and numbers unchanged" },
    ],
    cases: [
      { id: "t1", input: "Good morning", expected: "Bonjour", rubric: "Correct greeting.", distractor: "Good morning", difficulty: D[0] },
      { id: "t2", input: "Thank you very much", expected: "Merci beaucoup", rubric: "Correct phrase.", distractor: "Thanks a lot", difficulty: D[1] },
      { id: "t3", input: "Where is the train station?", expected: "Où est la gare", rubric: "Correct question.", distractor: "Where is the station?", difficulty: D[2] },
      { id: "t4", input: "I would like a coffee, please", expected: "Je voudrais un café", rubric: "Correct request.", distractor: "I want coffee", difficulty: D[3] },
    ],
  },
  {
    name: "code-reviewer",
    label: "Code reviewer",
    description: "Spots correctness bugs (and stays quiet when code is fine).",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "code-reviewer",
    default_prompt:
      "Review the code for correctness bugs only. If there is a bug, name it in one line and cite the cause. If the code is correct, reply exactly 'No bugs found.' Do not suggest style changes.",
    weak_prompt: "Take a look at this code and tell me what you think.",
    signals: [
      { text: "bug", tip: "Focus on correctness bugs" },
      { text: "one line", tip: "Require a one-line finding" },
      { text: "no bugs found", tip: "Define the 'clean' response" },
      { text: "style", tip: "Exclude style nitpicks" },
    ],
    cases: [
      { id: "c1", input: "for i in range(len(a)): print(a[i+1])", expected: "off-by-one", rubric: "Names the off-by-one.", distractor: "Looks good to me.", difficulty: D[0] },
      { id: "c2", input: "if x = 5: run()", expected: "assignment instead of comparison", rubric: "Names the = vs ==.", distractor: "No issues here.", difficulty: D[1] },
      { id: "c3", input: "def f(): return; log('done')", expected: "unreachable code after return", rubric: "Names dead code.", distractor: "Works fine.", difficulty: D[2] },
      { id: "c4", input: "def add(a, b): return a + b", expected: "No bugs found.", rubric: "Does NOT invent a bug.", distractor: "There is a bug in the addition.", difficulty: D[3] },
    ],
  },
  {
    name: "rag-qa",
    label: "Grounded Q&A (RAG)",
    description: "Answers only from the provided context; refuses otherwise.",
    target_model: "claude-opus-4-8",
    judge_model: "claude-opus-4-8",
    scorers: DS,
    thresholds: DT,
    golden_set: "rag-qa",
    default_prompt:
      "Answer using only the provided context. Quote the relevant fact and do not use outside knowledge. If the answer is not in the context, reply exactly 'Not in the provided context.'",
    weak_prompt: "Answer the question based on the passage below.",
    signals: [
      { text: "context", tip: "Restrict answers to the context" },
      { text: "quote", tip: "Require quoting the fact" },
      { text: "outside", tip: "Forbid outside knowledge" },
      { text: "not in the provided context", tip: "Define the refusal response" },
    ],
    cases: [
      { id: "r1", input: "Context: The Eiffel Tower is 330m tall. Q: How tall is it?", expected: "330m", rubric: "Grounded answer.", distractor: "About 300 feet.", difficulty: D[0] },
      { id: "r2", input: "Context: Our return window is 14 days. Q: How long do I have to return?", expected: "14 days", rubric: "Grounded answer.", distractor: "30 days.", difficulty: D[1] },
      { id: "r3", input: "Context: The store opens at 9am. Q: When does it close?", expected: "Not in the provided context.", rubric: "Refuses (not stated).", distractor: "It closes at 5pm.", difficulty: D[2] },
      { id: "r4", input: "Context: Plan A costs $10/mo. Q: What does Plan B cost?", expected: "Not in the provided context.", rubric: "Refuses (not stated).", distractor: "Plan B costs $20/mo.", difficulty: D[3] },
    ],
  },
];

export function getSuite(name: string): SuiteDef | undefined {
  return SUITES.find((s) => s.name === name);
}
