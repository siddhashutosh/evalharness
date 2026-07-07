import { NextResponse } from "next/server";
import { SUITES } from "@/lib/suites";
import { suiteSummary } from "@/lib/engine";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(SUITES.map((s) => suiteSummary(s)));
}
