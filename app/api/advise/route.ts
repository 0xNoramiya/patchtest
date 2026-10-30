import { NextResponse } from "next/server";
import { advise, type AdviseRequest } from "@/lib/advise";
import { config } from "@/lib/env";

export async function POST(request: Request) {
  let body: AdviseRequest;
  try {
    body = (await request.json()) as AdviseRequest;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  if (!body?.scanLabel) {
    return NextResponse.json({ error: "scanLabel is required" }, { status: 400 });
  }

  try {
    const result = await advise({ ...body, mode: config.demoMode });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    // A replay miss is the expected failure here and is worth saying plainly.
    const status = message.includes("No recorded agent response") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
