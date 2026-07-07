import { NextResponse } from "next/server";
import { getSuite } from "@/lib/suites";
import { newId, runSuite } from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { suite: name, quality = 1.0 } = body ?? {};
  const suite = getSuite(name);
  if (!suite) {
    return NextResponse.json({ detail: `suite not found: ${name}` }, { status: 404 });
  }
  const q = clamp(quality);
  const run = runSuite(suite, q);
  return NextResponse.json({ id: newId(), suite: name, quality: q, mode: "demo", run });
}

function clamp(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return 1.0;
  return Math.max(0, Math.min(1, n));
}
