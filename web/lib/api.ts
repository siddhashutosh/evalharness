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
  quality: number;
  mode?: string;
  baseline?: RunResult | null;
}

export const api = {
  base: BASE || "same-origin",
  health: () => req<{ status: string }>("/api/health"),
  suites: () => req<SuiteSummary[]>("/api/suites"),
  suite: (name: string) => req<SuiteSummary>(`/api/suites/${encodeURIComponent(name)}`),
  run: (o: RunOpts) =>
    req<{ id: string; run: RunResult }>("/api/run", {
      method: "POST",
      body: JSON.stringify({ suite: o.suite, quality: o.quality, mode: o.mode ?? "demo" }),
    }),
  baseline: (o: RunOpts) =>
    req<{ id: string; run: RunResult }>("/api/baseline", {
      method: "POST",
      body: JSON.stringify({ suite: o.suite, quality: o.quality, mode: o.mode ?? "demo" }),
    }),
  gate: (o: RunOpts) =>
    req<GateResponse>("/api/gate", {
      method: "POST",
      body: JSON.stringify({
        suite: o.suite,
        quality: o.quality,
        mode: o.mode ?? "demo",
        baseline: o.baseline ?? null,
      }),
    }),
};
