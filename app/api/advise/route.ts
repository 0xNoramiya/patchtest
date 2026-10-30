import { NextResponse } from "next/server";
import { advise, type AdviseRequest } from "@/lib/advise";

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
    const result = await advise(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    // A replay miss is the expected failure here and is worth saying plainly.
    if (message.includes("No recorded agent response")) {
      return NextResponse.json(
        {
          error:
            "This combination has not been recorded and no model key is configured here. Try one of the presets on the home page, which are all recorded.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
