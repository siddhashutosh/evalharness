import { NextResponse } from "next/server";
import { getSuite } from "@/lib/suites";
import { compare, newId, runWithPrompt } from "@/lib/engine";
import type { RunResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { suite: name, prompt = "", baseline } = body ?? {};
  const suite = getSuite(name);
  if (!suite) {
    return NextResponse.json({ detail: `suite not found: ${name}` }, { status: 404 });
  }
  const run = runWithPrompt(suite, String(prompt));

  // The frontend passes the baseline it holds (serverless has no shared state).
  const base = baseline as RunResult | undefined;
  if (!base || !base.cases) {
    return NextResponse.json({
      run,
      gate: null,
      error: "no baseline found for this suite — save one first",
    });
  }

  const gate = compare(run, base, suite.thresholds);
  return NextResponse.json({ run, gate, baseline: { run: base }, run_id: newId() });
}
