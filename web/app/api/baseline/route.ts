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
  const q = typeof quality === "number" ? Math.max(0, Math.min(1, quality)) : 1.0;
  const run = runSuite(suite, q);
  // Stateless: the client stores this run and passes it back as the baseline on gate.
  return NextResponse.json({ id: newId(), suite: name, quality: q, mode: "demo", run });
}
