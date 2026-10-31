#!/usr/bin/env node
/**
 * A stdio bridge to the PatchTest MCP endpoint, for clients that cannot add an
 * HTTP server directly.
 *
 * It is a pipe and nothing more: newline-delimited JSON-RPC in on stdin, each
 * message POSTed to the endpoint, each response written back on stdout. It holds
 * no state, because the server holds none either.
 *
 *   node mcp/stdio.mjs [url]
 *
 * Default endpoint: https://patchtest.fly.dev/api/mcp
 * Diagnostics go to stderr, never stdout — anything on stdout has to be a
 * JSON-RPC message or the client will fail to parse the stream.
 */
const endpoint = process.argv[2] ?? process.env.PATCHTEST_MCP_URL ?? "https://patchtest.fly.dev/api/mcp";

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

async function forward(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    send({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } });
    return;
  }

  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  // Mirror the fields the transport asks for, so an intermediary can route on
  // them and the server's header check has something to agree with.
  if (typeof message.method === "string") headers["Mcp-Method"] = message.method;
  const version = message.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
  if (typeof version === "string") headers["MCP-Protocol-Version"] = version;
  const name = message.params?.name ?? message.params?.uri;
  if (typeof name === "string" && /^[\x20-\x7e]*$/.test(name) && name.trim() === name) {
    headers["Mcp-Name"] = name;
  }

  let response;
  try {
    response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(message) });
  } catch (error) {
    if (message.id === undefined || message.id === null) return;
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32603, message: `Could not reach ${endpoint}: ${error.message}` },
    });
    return;
  }

  const body = await response.text();
  if (!body) return; // 202 for a notification: nothing to pass back.
  try {
    send(JSON.parse(body));
  } catch {
    if (message.id === undefined || message.id === null) return;
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32603, message: `${endpoint} answered ${response.status} with non-JSON` },
    });
  }
}

// Messages are handled in order: a client may expect its responses in the order
// it sent the requests, and nothing here is slow enough to be worth racing.
let queue = Promise.resolve();
let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) queue = queue.then(() => forward(line));
  }
});
process.stdin.on("end", () => {
  queue.then(() => process.exit(0));
});
