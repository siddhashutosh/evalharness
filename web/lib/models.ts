// Client-safe model list for live mode (no SDK import — safe in the browser).

export const LIVE_MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — fastest / cheapest" },
  { id: "claude-sonnet-5", label: "Sonnet 5 — balanced" },
  { id: "claude-opus-4-8", label: "Opus 4.8 — highest quality" },
] as const;

export const DEFAULT_LIVE_MODEL = "claude-haiku-4-5";
