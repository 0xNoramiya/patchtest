import { NextResponse } from "next/server";
import { checkCart, validateCheckCart } from "@/lib/check-cart";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * The extension's entry point. The judging itself lives in `lib/check-cart.ts`,
 * which `/api/mcp` calls too, so the browser and an agent cannot drift apart.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400, headers: CORS });
  }

  const parsed = validateCheckCart(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: CORS });
  }

  return NextResponse.json(await checkCart(parsed.value), { headers: CORS });
}
