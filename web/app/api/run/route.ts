import { NextResponse } from "next/server";
import { getSuite } from "@/lib/suites";
import { newId } from "@/lib/engine";
import { errMsg, evaluate } from "@/lib/live";

export const runtime = "nodejs";
export const maxDuration = 60; // live mode makes several model calls

export async function POST(req: Request) {
  const key = req.headers.get("x-anthropic-key");
  const body = await req.json().catch(() => ({}));
  const { suite: name, prompt = "", mode = "demo", model } = body ?? {};
  const suite = getSuite(name);
  if (!suite) {
    return NextResponse.json({ detail: `suite not found: ${name}` }, { status: 404 });
  }
  try {
    const run = await evaluate(suite, String(prompt), mode, model, key);
    return NextResponse.json({ id: newId(), suite: name, mode, run });
  } catch (e) {
    return NextResponse.json({ detail: errMsg(e) }, { status: 400 });
  }
}
