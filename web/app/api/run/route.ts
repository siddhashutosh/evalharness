import { NextResponse } from "next/server";
import { getSuite } from "@/lib/suites";
import { newId, runWithPrompt } from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { suite: name, prompt = "" } = body ?? {};
  const suite = getSuite(name);
  if (!suite) {
    return NextResponse.json({ detail: `suite not found: ${name}` }, { status: 404 });
  }
  const run = runWithPrompt(suite, String(prompt));
  return NextResponse.json({ id: newId(), suite: name, prompt, mode: "demo", run });
}
