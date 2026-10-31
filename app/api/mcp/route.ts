import { NextResponse } from "next/server";
import { handleMessage } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

/**
 * The MCP endpoint, Streamable HTTP. One POST per JSON-RPC message.
 *
 * Open to any origin and unauthenticated, which is a decision rather than an
 * oversight: every tool is read-only, spends nothing, and reads only files
 * committed to this repository. The DNS-rebinding warning in the transport spec
 * is about servers bound to localhost that can reach a private network; this one
 * reaches nothing.
 *
 * No SSE and no GET stream. Each tool returns in a single response, so there is
 * nothing to stream, and this revision of the transport has no GET endpoint.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error: body is not JSON" } },
      { status: 400, headers: CORS },
    );
  }

  const outcome = await handleMessage(message, request.headers);
  if (outcome.body === null) return new NextResponse(null, { status: outcome.status, headers: CORS });
  return NextResponse.json(outcome.body, { status: outcome.status, headers: CORS });
}

/** Both belonged to the session mechanics this revision removed. */
const gone = () =>
  NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32601, message: "This MCP endpoint accepts POST only" } },
    { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } },
  );

export const GET = gone;
export const DELETE = gone;
