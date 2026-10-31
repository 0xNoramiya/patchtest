# The MCP server

The same guardrail the site and the extension run, exposed as an MCP server so an
agent can call it before it sells something.

```
https://patchtest.fly.dev/api/mcp
```

No key, no account, nothing to install. Three tools, all read-only:

| Tool | What it does |
|---|---|
| `check_cart` | Judges a cart. One verdict per item, each carrying the rule id, the source URL and a quote from it |
| `list_rules` | The whole rule corpus, with every source and every caveat |
| `list_scans` | The recorded YouCam scans a check can be judged against |

## Adding it

**Claude Code**

```bash
claude mcp add --transport http patchtest https://patchtest.fly.dev/api/mcp
```

**Anything that takes an HTTP MCP server** — Claude Desktop, Cursor, VS Code — point it
at the same URL.

**A client that only speaks stdio.** `mcp/stdio.mjs` is a pipe to the endpoint and
needs nothing but Node:

```json
{
  "mcpServers": {
    "patchtest": {
      "command": "node",
      "args": ["/path/to/patchtest/mcp/stdio.mjs"]
    }
  }
}
```

Pass a different endpoint as the first argument, or set `PATCHTEST_MCP_URL`, to run
it against a local `pnpm dev`.

## What a call looks like

```bash
curl -s https://patchtest.fly.dev/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Mcp-Method: tools/call' -H 'Mcp-Name: check_cart' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
        "name":"check_cart",
        "arguments":{
          "items":[{"name":"Adapalene 0.1% Gel"}],
          "intake":{"pregnancy":"pregnant"},
          "scanLabel":"synthetic-09-olive"}}}'
```

```
BLOCK  Adapalene 0.1% Gel
  [R-PREG-01] BLOCK: Not for you right now. Retinoids are the one group that
    pregnancy skincare guidance consistently says to avoid, including the
    over-the-counter ones.
    instead: Azelaic Acid 10% Cream ($26) [LL-111]
    source says: "It is generally recommended to avoid topical retinoid medications."
    https://www.aad.org/public/everyday-care/skin-care-secrets/routine/pregnancy-skin-care
    ...
```

Trimmed: the real result also lists a second source for that rule and a second
finding, `R-FITZ-02`, because the scan read Fitzpatrick V. The call above returns
both, plus the same thing again as `structuredContent` for a caller that would
rather parse than read.

Product titles are parsed for actives and strengths, so pass them as the shop
writes them. A title that names no active ingredient comes back `UNKNOWN`, never
`OK` — the server's instructions tell the calling model, in as many words, that an
absent verdict is not a safety clearance.

## Why the tools are shaped this way

The project's one invariant is that **the model proposes and the rules decide**.
Exposing that over MCP means being careful about what an agent can reach:

- There is no tool that writes anything. Nothing here edits a rule, sets a verdict,
  spends a YouCam unit or stores a profile. A test asserts that every tool carries
  `readOnlyHint`.
- `check_cart` returns findings, not a recommendation. Every finding has a rule id,
  so a calling model can show the shopper the reason instead of asserting the
  conclusion in its own voice.
- `list_rules` ships the caveats with the rules. Seven of the 21 sources say less
  than the rule they back, and each says so in its own `notes` field, which comes
  back in the tool result. An agent that wants to be honest about the basis can be.
- `list_scans` returns `raw` and `ui` side by side and says which one the rules use.
  That is the project's central finding, and an agent reasoning from the display
  score would be making exactly the mistake the engine was built to avoid.

The judging itself is `lib/check-cart.ts`, which `/api/check-cart` calls too, so the
extension in a browser and an agent over MCP cannot drift apart.

## Protocol notes

The endpoint is **dual-era**. Revision `2026-07-28` removed the `initialize`
handshake and protocol-level sessions; `2025-11-25` and earlier require them. The
spec allows one endpoint to serve both, and this one does — every tool is stateless
and read-only, so there was never any session state to keep. `server/discover`,
`tools/list` and `tools/call` work without a handshake; `initialize` still gets an
answer, with the client's own revision echoed back when we have it.

Streamable HTTP, POST only. Nothing here streams, so there is no SSE and no GET
endpoint, and `GET` and `DELETE` return 405. Status codes follow the transport: 400
with `-32022` for a version we do not support, 400 with `-32020` for a header that
contradicts the body, 404 with `-32601` for an unknown method, 202 for a
notification.

**One deliberate deviation, rather than a silent one.** The transport requires the
`Mcp-Method` and `Mcp-Name` headers on a modern request and says a server MUST
reject a request that omits one. We reject a header that *disagrees* with the body —
that divergence is the security problem the rule exists to prevent — but we serve a
request that simply leaves the header out, so a client in the middle of migrating
still works. If you need strict rejection, it is four lines in `lib/mcp/server.ts`.

The endpoint is open to any origin and unauthenticated. That is a decision: every
tool is read-only, costs nothing to run, and reads only files committed to this
repository. The DNS-rebinding warning in the transport spec is about servers bound
to localhost that can reach a private network, and this one reaches nothing.
