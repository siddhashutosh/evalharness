// Thin client for the evalharness FastAPI backend.

import type {
  GateResponse,
  RunResult,
  RunSummary,
  SuiteSummary,
} from "./types";

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

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
      `Cannot reach the API at ${BASE}. Is the backend running? (uvicorn server.app:app)`,
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
  baseline_id?: string | null;
}

export const api = {
  base: BASE,
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
        baseline_id: o.baseline_id ?? null,
      }),
    }),
  runs: () => req<RunSummary[]>("/api/runs"),
  runById: (id: string) => req<{ id: string; run: RunResult }>(`/api/runs/${id}`),
};
