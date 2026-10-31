/**
 * The MCP wire protocol for PatchTest, as a pure function over one JSON-RPC
 * message.
 *
 * It is dual-era on purpose. Revision 2026-07-28 removed the `initialize`
 * handshake and protocol-level sessions, and the spec explicitly allows one
 * endpoint to serve both eras at once; a judge's client may be either. Because
 * every tool here is stateless and read-only there is nothing a session was
 * holding, so serving both costs a version check rather than a second code path.
 *
 * Deliberate deviation, stated rather than hidden: on a modern request the
 * transport requires `Mcp-Method` and `Mcp-Name` headers and says a server MUST
 * reject a request that omits one. We reject a header that *disagrees* with the
 * body — which is the divergence the rule exists to prevent — but serve a
 * request that simply omits it, so a client that is mid-migration still works.
 */
import { TOOLS, toolByName } from "./tools";

export const MODERN_VERSION = "2026-07-28";
/** Handshake-era revisions we still answer. */
export const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const SUPPORTED_VERSIONS = [MODERN_VERSION, ...LEGACY_VERSIONS];

export const SERVER_INFO = { name: "patchtest", version: "1.0.0" };

export const CAPABILITIES = { tools: { listChanged: false } };

export const INSTRUCTIONS =
  "PatchTest judges a skincare cart before checkout. Call check_cart before you recommend, add or " +
  "buy any skincare product, and pass the shopper's declared intake with it.\n\n" +
  "The verdicts come from a deterministic rules engine over 24 cited rules, not from a language " +
  "model. Report them; do not rewrite, soften or overrule them, and do not invent a verdict of " +
  "your own. Every finding carries the rule id, the source URL and a short quote, so show the " +
  "shopper the reason rather than asserting the conclusion.\n\n" +
  "An item that comes back UNKNOWN had a title that named no active ingredient or strength, so no " +
  "rule could be applied. That is not a safety clearance and must never be presented as one. The " +
  "same goes for a cart with no findings: the rule corpus is finite.\n\n" +
  "Nothing here diagnoses or treats anything. A REFER verdict means the shopper should see a " +
  "professional, which is not something a better product can replace.";

const TTL_MS = 3_600_000;

/** Errors defined by the spec for the modern era. */
const HEADER_MISMATCH = -32020;
const UNSUPPORTED_VERSION = -32022;

export type JsonRpcId = string | number;

export type McpOutcome = {
  status: number;
  /** null means "no body", which pairs with 202 for an accepted notification. */
  body: Record<string, unknown> | null;
};

type Headers = { get(name: string): string | null };

const meta = () => ({ "io.modelcontextprotocol/serverInfo": SERVER_INFO });

function ok(id: JsonRpcId, result: Record<string, unknown>, status = 200): McpOutcome {
  return {
    status,
    body: { jsonrpc: "2.0", id, result: { resultType: "complete", ...result, _meta: meta() } },
  };
}

function fail(
  id: JsonRpcId | null,
  code: number,
  message: string,
  status: number,
  data?: unknown,
): McpOutcome {
  const error: Record<string, unknown> = { code, message };
  if (data !== undefined) error.data = data;
  return { status, body: { jsonrpc: "2.0", ...(id === null ? {} : { id }), error } };
}

/** `=?base64?...?=` is the transport's escape for a header value that is not plain ASCII. */
function decodeHeader(value: string): string {
  const match = /^=\?base64\?(.*)\?=$/.exec(value);
  return match ? Buffer.from(match[1], "base64").toString("utf8") : value;
}

export async function handleMessage(message: unknown, headers: Headers): Promise<McpOutcome> {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return fail(null, -32600, "Expected a single JSON-RPC 2.0 message object", 400);
  }
  const msg = message as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return fail(null, -32600, "Not a JSON-RPC 2.0 request: jsonrpc must be \"2.0\" and method a string", 400);
  }

  const method = msg.method;
  const params = (typeof msg.params === "object" && msg.params !== null ? msg.params : {}) as Record<
    string,
    unknown
  >;

  // A notification carries no id and gets no response, only an acknowledgement.
  if (msg.id === undefined || msg.id === null) {
    return { status: 202, body: null };
  }
  const id = msg.id as JsonRpcId;

  const reqMeta = (typeof params._meta === "object" && params._meta !== null ? params._meta : {}) as Record<
    string,
    unknown
  >;
  const declared = reqMeta["io.modelcontextprotocol/protocolVersion"];
  const modern = typeof declared === "string";

  if (modern) {
    if (!SUPPORTED_VERSIONS.includes(declared)) {
      return fail(id, UNSUPPORTED_VERSION, "Unsupported protocol version", 400, {
        supported: SUPPORTED_VERSIONS,
        requested: declared,
      });
    }
    const headerVersion = headers.get("mcp-protocol-version");
    if (headerVersion && headerVersion !== declared) {
      return fail(
        id,
        HEADER_MISMATCH,
        `Header mismatch: MCP-Protocol-Version header value '${headerVersion}' does not match body value '${declared}'`,
        400,
      );
    }
    const headerMethod = headers.get("mcp-method");
    if (headerMethod && headerMethod !== method) {
      return fail(
        id,
        HEADER_MISMATCH,
        `Header mismatch: Mcp-Method header value '${headerMethod}' does not match body value '${method}'`,
        400,
      );
    }
    const headerName = headers.get("mcp-name");
    if (headerName && typeof params.name === "string" && decodeHeader(headerName) !== params.name) {
      return fail(
        id,
        HEADER_MISMATCH,
        `Header mismatch: Mcp-Name header value '${decodeHeader(headerName)}' does not match body value '${params.name}'`,
        400,
      );
    }
  }

  /** Unknown methods are a 404 in the modern transport and a plain error before it. */
  const unknownMethod = () =>
    fail(id, -32601, `Method not found: ${method}`, modern ? 404 : 200);
  const badParams = (detail: string) => fail(id, -32602, detail, modern ? 400 : 200);

  switch (method) {
    case "server/discover":
      return ok(id, {
        supportedVersions: SUPPORTED_VERSIONS,
        capabilities: CAPABILITIES,
        instructions: INSTRUCTIONS,
        ttlMs: TTL_MS,
        cacheScope: "public",
      });

    // The handshake-era opener. Answering it is what makes this server dual-era.
    case "initialize": {
      if (modern) return unknownMethod();
      const asked = params.protocolVersion;
      const agreed =
        typeof asked === "string" && SUPPORTED_VERSIONS.includes(asked) ? asked : LEGACY_VERSIONS[0];
      return ok(id, {
        protocolVersion: agreed,
        capabilities: CAPABILITIES,
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case "ping":
      return modern ? unknownMethod() : ok(id, {});

    case "tools/list":
      return ok(id, {
        tools: TOOLS.map(({ name, title, description, inputSchema, outputSchema, annotations }) => ({
          name,
          title,
          description,
          inputSchema,
          ...(outputSchema ? { outputSchema } : {}),
          ...(annotations ? { annotations } : {}),
        })),
        ttlMs: TTL_MS,
        cacheScope: "public",
      });

    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string") return badParams("params.name is required");
      const tool = toolByName(name);
      if (!tool) {
        return badParams(
          `Unknown tool: ${name}. This server has ${TOOLS.map((t) => t.name).join(", ")}.`,
        );
      }
      const args = (typeof params.arguments === "object" && params.arguments !== null
        ? params.arguments
        : {}) as Record<string, unknown>;
      try {
        const result = await tool.run(args);
        return ok(id, { isError: false, ...result });
      } catch (error) {
        // A thrown tool is a tool-execution error, not a protocol error: the
        // model can read it and fix its arguments.
        const detail = error instanceof Error ? error.message : String(error);
        return ok(id, {
          content: [{ type: "text", text: `${name} failed: ${detail}` }],
          isError: true,
        });
      }
    }

    default:
      return unknownMethod();
  }
}
