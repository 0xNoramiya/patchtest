import { describe, expect, it } from "vitest";
import {
  handleMessage,
  LEGACY_VERSIONS,
  MODERN_VERSION,
  SUPPORTED_VERSIONS,
  type McpOutcome,
} from "./server";
import { TOOLS } from "./tools";

const noHeaders = { get: () => null };
const headers = (map: Record<string, string>) => ({
  get: (name: string) => map[name.toLowerCase()] ?? null,
});

const modernMeta = {
  "io.modelcontextprotocol/protocolVersion": MODERN_VERSION,
  "io.modelcontextprotocol/clientCapabilities": {},
};

type Body = Record<string, unknown>;
const result = (outcome: McpOutcome) => (outcome.body as Body).result as Body;
const error = (outcome: McpOutcome) => (outcome.body as Body).error as Body;

const call = (name: string, args: Record<string, unknown> = {}) =>
  handleMessage(
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
    noHeaders,
  );

/** The text an LLM actually reads, joined. */
const spoken = (outcome: McpOutcome) =>
  (result(outcome).content as Array<{ text: string }>).map((c) => c.text).join("\n");

describe("the MCP endpoint speaks both protocol eras", () => {
  it("answers server/discover with its versions, capabilities and identity", async () => {
    const outcome = await handleMessage(
      { jsonrpc: "2.0", id: "d1", method: "server/discover", params: { _meta: modernMeta } },
      headers({ "mcp-protocol-version": MODERN_VERSION, "mcp-method": "server/discover" }),
    );
    expect(outcome.status).toBe(200);
    expect(result(outcome).resultType).toBe("complete");
    expect(result(outcome).supportedVersions).toContain(MODERN_VERSION);
    expect(result(outcome).capabilities).toStrictEqual({ tools: { listChanged: false } });
    const meta = result(outcome)._meta as Body;
    expect(meta["io.modelcontextprotocol/serverInfo"]).toStrictEqual({
      name: "patchtest",
      version: "1.0.0",
    });
  });

  it("still answers the handshake a pre-2026 client opens with", async () => {
    const outcome = await handleMessage(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {} },
      },
      noHeaders,
    );
    expect(outcome.status).toBe(200);
    expect(result(outcome).protocolVersion).toBe("2025-06-18");
    expect(result(outcome).serverInfo).toStrictEqual({ name: "patchtest", version: "1.0.0" });
  });

  it("falls back to a version it has when the handshake asks for one it does not", async () => {
    const outcome = await handleMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1900-01-01" } },
      noHeaders,
    );
    expect(result(outcome).protocolVersion).toBe(LEGACY_VERSIONS[0]);
  });

  it("rejects a declared version it does not support, and says which it has", async () => {
    const outcome = await handleMessage(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: { _meta: { "io.modelcontextprotocol/protocolVersion": "1900-01-01" } },
      },
      noHeaders,
    );
    expect(outcome.status).toBe(400);
    expect(error(outcome).code).toBe(-32022);
    expect((error(outcome).data as Body).supported).toStrictEqual(SUPPORTED_VERSIONS);
  });

  it("refuses a header that disagrees with the body", async () => {
    const outcome = await handleMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: modernMeta } },
      headers({ "mcp-protocol-version": "2025-06-18" }),
    );
    expect(outcome.status).toBe(400);
    expect(error(outcome).code).toBe(-32020);
  });

  it("refuses an Mcp-Name that disagrees with the tool being called", async () => {
    const outcome = await handleMessage(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "list_rules", arguments: {}, _meta: modernMeta },
      },
      headers({ "mcp-method": "tools/call", "mcp-name": "check_cart" }),
    );
    expect(outcome.status).toBe(400);
    expect(error(outcome).code).toBe(-32020);
  });

  it("serves a modern request that omits the mirrored headers", async () => {
    const outcome = await handleMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: modernMeta } },
      noHeaders,
    );
    expect(outcome.status).toBe(200);
    expect(result(outcome).tools).toHaveLength(TOOLS.length);
  });

  it("treats the retired handshake as an unknown method on a modern request", async () => {
    const outcome = await handleMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { _meta: modernMeta } },
      noHeaders,
    );
    expect(outcome.status).toBe(404);
    expect(error(outcome).code).toBe(-32601);
  });

  it("acknowledges a notification without answering it", async () => {
    const outcome = await handleMessage(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      noHeaders,
    );
    expect(outcome).toStrictEqual({ status: 202, body: null });
  });

  it("rejects something that is not a JSON-RPC message at all", async () => {
    expect((await handleMessage({ hello: "there" }, noHeaders)).status).toBe(400);
    expect((await handleMessage([], noHeaders)).status).toBe(400);
  });
});

describe("the tools it advertises", () => {
  it("lists them in a fixed order, so a client can cache them", async () => {
    const first = result(await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, noHeaders));
    const second = result(await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, noHeaders));
    expect(first.tools).toStrictEqual(second.tools);
    expect((first.tools as Array<{ name: string }>).map((t) => t.name)).toStrictEqual([
      "check_cart",
      "list_rules",
      "list_scans",
    ]);
  });

  it("gives every tool an object input schema and a readable description", () => {
    for (const tool of TOOLS) {
      expect(tool.inputSchema.type, tool.name).toBe("object");
      expect(tool.description.length, tool.name).toBeGreaterThan(80);
    }
  });

  // The guardrail is a thing an agent reads, never a thing it writes. There is
  // no tool here that edits a rule, sets a verdict, or spends a YouCam unit.
  it("exposes nothing that mutates anything", () => {
    for (const tool of TOOLS) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
    }
  });

  it("refuses a tool it does not have, by name", async () => {
    const outcome = await call("buy_everything");
    expect(error(outcome).code).toBe(-32602);
    expect(error(outcome).message).toContain("check_cart");
  });
});

describe("check_cart over MCP", () => {
  it("blocks the retinoid a pregnant shopper asked to keep, with the rule and the source", async () => {
    const outcome = await call("check_cart", {
      items: [{ name: "Adapalene 0.1% Gel" }],
      intake: { pregnancy: "pregnant" },
      scanLabel: "synthetic-09-olive",
    });
    const items = (result(outcome).structuredContent as { items: Array<Record<string, unknown>> }).items;
    expect(items[0].verdict).toBe("BLOCK");
    const findings = items[0].findings as Array<Record<string, unknown>>;
    expect(findings.some((f) => f.ruleId === "R-PREG-01")).toBe(true);
    expect((findings[0].sourceUrls as string[]).length).toBeGreaterThan(0);
    expect(result(outcome).isError).toBe(false);
  });

  it("gives every finding a rule id, because no verdict here comes from prose", async () => {
    const outcome = await call("check_cart", {
      items: [{ name: "Glycolic Acid 30% Peel" }, { name: "Retinol 0.3% Night Serum" }],
      intake: { ageBand: "under_13" },
    });
    const items = (result(outcome).structuredContent as { items: Array<Record<string, unknown>> }).items;
    const findings = items.flatMap((i) => i.findings as Array<Record<string, unknown>>);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(typeof f.ruleId).toBe("string");
  });

  it("returns UNKNOWN for a title it cannot read, and says that is not a clearance", async () => {
    const outcome = await call("check_cart", { items: [{ name: "Midnight Glow Elixir" }] });
    const items = (result(outcome).structuredContent as { items: Array<Record<string, unknown>> }).items;
    expect(items[0].verdict).toBe("UNKNOWN");
    expect(spoken(outcome)).toContain("not a safety clearance");
  });

  it("says so when the scan it was pointed at does not exist", async () => {
    const outcome = await call("check_cart", {
      items: [{ name: "Retinol 0.3% Night Serum" }],
      scanLabel: "no-such-scan",
    });
    const warnings = (result(outcome).structuredContent as { warnings: string[] }).warnings;
    expect(warnings.join(" ")).toContain("no-such-scan");
    expect(spoken(outcome)).toContain("no-such-scan");
  });

  it("asks for a cart rather than guessing when none is given", async () => {
    const outcome = await call("check_cart", { items: [] });
    expect(result(outcome).isError).toBe(true);
    expect(spoken(outcome)).toContain("items is required");
  });
});

describe("the reference tools", () => {
  it("returns one rule by id, with its quote and access date", async () => {
    const outcome = await call("list_rules", { id: "r-preg-01" });
    const rules = (result(outcome).structuredContent as { rules: Array<Record<string, unknown>> }).rules;
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("R-PREG-01");
    expect(rules[0].sourceQuote).toBeTruthy();
    expect(rules[0].sourceAccessed).toBeTruthy();
  });

  it("tells an agent which ids exist rather than returning an empty list", async () => {
    const outcome = await call("list_rules", { id: "R-NOPE-99" });
    expect(result(outcome).isError).toBe(true);
    expect(spoken(outcome)).toContain("rules are in force");
  });

  it("offers the recorded scans with both the measurement and the display score", async () => {
    const outcome = await call("list_scans");
    const scans = (result(outcome).structuredContent as { scans: Array<Record<string, unknown>> }).scans;
    expect(scans.length).toBeGreaterThan(5);
    const pigment = scans.find((s) => s.label === "synthetic-04-pigment");
    expect(pigment?.fitzpatrick).toBe("V");
    const concerns = pigment?.concernsBelowHealthy as Array<Record<string, number>>;
    expect(concerns.length).toBeGreaterThan(0);
    expect(concerns[0]).toHaveProperty("raw");
    expect(concerns[0]).toHaveProperty("ui");
  });
});

describe("a swap is a product, not an internal code", () => {
  it("resolves every swap in the rule corpus to a real catalogue product", async () => {
    const outcome = await call("list_rules");
    const rules = (result(outcome).structuredContent as {
      rules: Array<{ id: string; swap: { sku: string; name: string; price: number | null } | null }>;
    }).rules;
    const withSwap = rules.filter((r) => r.swap);
    expect(withSwap.length).toBeGreaterThan(5);
    for (const rule of withSwap) {
      expect(rule.swap!.name, rule.id).not.toBe(rule.swap!.sku);
      expect(rule.swap!.price, rule.id).toBeGreaterThan(0);
    }
  });

  it("names the product a blocked item should be replaced with", async () => {
    const outcome = await call("check_cart", {
      items: [{ name: "Adapalene 0.1% Gel" }],
      intake: { pregnancy: "pregnant" },
    });
    expect(spoken(outcome)).toMatch(/instead: .+ \(\$\d+\) \[LL-\d+\]/);
  });
});
