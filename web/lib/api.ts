// Client for the eval API. By default calls same-origin `/api/*` (the Next.js
// route handlers). Set NEXT_PUBLIC_API_URL to target the Python FastAPI backend
// instead (e.g. http://localhost:8000 during local development).

import type { GateResponse, RunResult, SuiteSummary } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

export class ApiError extends Error {}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      BASE
        ? `Cannot reach the API at ${BASE}. Is the backend running?`
        : "Request failed. Please try again.",
    );
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

export interface RunOpts {
  suite: string;
  prompt: string;
  mode?: "demo" | "live";
  model?: string;
  apiKey?: string | null;
  baseline?: RunResult | null;
}

// The API key rides in a header (not the body) and is used per request only.
function headersFor(o: RunOpts): Record<string, string> {
  return o.mode === "live" && o.apiKey ? { "x-anthropic-key": o.apiKey } : {};
}

function bodyFor(o: RunOpts, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    suite: o.suite,
    prompt: o.prompt,
    mode: o.mode ?? "demo",
    model: o.model,
    ...extra,
  });
}

export const api = {
  base: BASE || "same-origin",
  health: () => req<{ status: string }>("/api/health"),
  suites: () => req<SuiteSummary[]>("/api/suites"),
  suite: (name: string) => req<SuiteSummary>(`/api/suites/${encodeURIComponent(name)}`),
  run: (o: RunOpts) =>
    req<{ id: string; run: RunResult }>("/api/run", {
      method: "POST",
      headers: headersFor(o),
      body: bodyFor(o),
    }),
  baseline: (o: RunOpts) =>
    req<{ id: string; run: RunResult }>("/api/baseline", {
      method: "POST",
      headers: headersFor(o),
      body: bodyFor(o),
    }),
  gate: (o: RunOpts) =>
    req<GateResponse>("/api/gate", {
      method: "POST",
      headers: headersFor(o),
      body: bodyFor(o, { baseline: o.baseline ?? null }),
    }),
};
