import { NextResponse } from "next/server";
import { getSuite } from "@/lib/suites";
import { compare, newId } from "@/lib/engine";
import { errMsg, evaluate } from "@/lib/live";
import type { RunResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const key = req.headers.get("x-anthropic-key");
  const body = await req.json().catch(() => ({}));
  const { suite: name, prompt = "", mode = "demo", model, baseline } = body ?? {};
  const suite = getSuite(name);
  if (!suite) {
    return NextResponse.json({ detail: `suite not found: ${name}` }, { status: 404 });
  }

  let run: RunResult;
  try {
    run = await evaluate(suite, String(prompt), mode, model, key);
  } catch (e) {
    return NextResponse.json({ detail: errMsg(e) }, { status: 400 });
  }

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
