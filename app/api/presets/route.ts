import { NextResponse } from "next/server";
import { PRESETS } from "@/lib/presets";

export async function GET() {
  return NextResponse.json({ presets: PRESETS });
}
