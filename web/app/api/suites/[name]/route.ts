import { NextResponse } from "next/server";
import { getSuite } from "@/lib/suites";
import { suiteSummary } from "@/lib/engine";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const suite = getSuite(params.name);
  if (!suite) {
    return NextResponse.json({ detail: `suite not found: ${params.name}` }, { status: 404 });
  }
  return NextResponse.json(suiteSummary(suite, true));
}
