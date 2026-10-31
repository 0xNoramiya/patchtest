import { CopyCommand } from "@/components/CopyCommand";
import { Key, Step } from "@/components/Steps";
import { TOOLS } from "@/lib/mcp/tools";

export const metadata = {
  title: "Use it from an agent | PatchTest",
  description:
    "Add PatchTest as an MCP server so an agent checks a skincare cart against cited rules before it sells.",
};

const REPO = "https://github.com/0xNoramiya/patchtest";
const ENDPOINT = "https://patchtest.fly.dev/api/mcp";
const ADD_COMMAND = `claude mcp add --transport http patchtest ${ENDPOINT}`;

/** One plain sentence each. The names and titles come from the server itself. */
const BLURB: Record<string, string> = {
  check_cart:
    "Judges a cart. One verdict per item, each carrying the rule that produced it, the source URL and a quote from that source.",
  list_rules:
    "The whole rule corpus, with every source, every quote and every caveat — including the seven rules whose source says less than the rule does.",
  list_scans:
    "The recorded skin scans a check can be judged against. Each concern comes back with the measured score and the display score side by side.",
};

const CLIENT_CONFIG = `{
  "mcpServers": {
    "patchtest": {
      "command": "node",
      "args": ["/path/to/patchtest/mcp/stdio.mjs"]
    }
  }
}`;

const EXAMPLE = `BLOCK  Adapalene 0.1% Gel
  [R-PREG-01] Not for you right now. Retinoids are the one group that
    pregnancy skincare guidance consistently says to avoid, including
    the over-the-counter ones.
    instead: Azelaic Acid 10% Cream ($26) [LL-111]
    source says: "It is generally recommended to avoid topical retinoid
    medications."
    aad.org/public/everyday-care/skin-care-secrets/routine/pregnancy-skin-care`;

export default function McpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="anim-hero label text-faint">Model Context Protocol</p>
      <h1 className="anim-hero mt-2 font-display text-4xl" style={{ "--i": 1 } as React.CSSProperties}>
        Let an agent check the cart before it sells
      </h1>
      <p
        className="anim-hero mt-3 text-base leading-relaxed text-muted"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        The extension puts the guardrail where people shop. This puts it where agents shop. PatchTest
        runs as an MCP server, so anything that speaks the protocol can send it a cart and get back a
        verdict per item with the rule and the source behind it &mdash; before it recommends, adds or
        buys anything.
      </p>

      <div className="anim-hero mt-7" style={{ "--i": 3 } as React.CSSProperties}>
        <CopyCommand command={ADD_COMMAND} label="Claude Code, one line" />
      </div>

      <p className="anim-hero mt-4 rounded-lg border border-line bg-sunken px-4 py-3 text-sm leading-relaxed text-muted" style={{ "--i": 4 } as React.CSSProperties}>
        No key, no account, nothing to install. Every tool is read-only: nothing an agent can reach
        from here edits a rule, sets a verdict, stores a profile or spends a YouCam unit.
      </p>

      <section className="mt-11">
        <h2 className="anim-reveal font-display text-2xl">Add it</h2>
        <ol className="mt-5">
          <Step n={1} title="Claude Code">
            <p>
              Run the line above. That is the whole thing &mdash; it is an HTTP server, so there is
              nothing to clone and nothing to keep running.
            </p>
          </Step>
          <Step n={2} title="Claude Desktop, Cursor, VS Code, anything else over HTTP">
            <p>
              Add a server of type <Key>http</Key> and paste the endpoint:
            </p>
            <div className="pt-1">
              <CopyCommand command={ENDPOINT} />
            </div>
          </Step>
          <Step n={3} last title="A client that only speaks stdio">
            <p>
              Some clients cannot take an HTTP server. <Key>mcp/stdio.mjs</Key> in the repository is
              a pipe to the same endpoint and needs nothing but Node:
            </p>
            <div className="pt-1">
              <CopyCommand command={CLIENT_CONFIG} />
            </div>
            <p>
              Pass a different endpoint as the first argument, or set{" "}
              <Key>PATCHTEST_MCP_URL</Key>, to point it at a local <Key>pnpm dev</Key>.
            </p>
          </Step>
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="anim-reveal font-display text-2xl">What it gives the agent</h2>
        <ul className="mt-5 space-y-3">
          {TOOLS.map((tool, i) => (
            <li
              key={tool.name}
              className="anim-reveal rounded-xl border border-line bg-surface p-5 shadow-card"
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code className="font-mono text-sm font-medium text-accent">{tool.name}</code>
                <span className="text-sm text-faint">{tool.title}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {BLURB[tool.name] ?? tool.title}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="anim-reveal mt-10">
        <h2 className="font-display text-2xl">What comes back</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Ask it about a cart with an adapalene gel in it, for someone eight weeks pregnant, and the
          agent reads this:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-sunken p-4 font-mono text-[0.78rem] leading-6 text-ink">
          {EXAMPLE}
        </pre>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Trimmed &mdash; the real result also carries a second source for that rule, a second
          finding because the scan read Fitzpatrick V, and the same thing again as structured JSON
          for a caller that would rather parse than read.
        </p>
      </section>

      <section className="mt-10 rounded-xl border border-line bg-surface p-6 shadow-card">
        <h2 className="anim-reveal font-display text-xl">The part that matters for an agent</h2>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted">
          <li>
            <strong className="font-medium text-ink">The verdicts are not the model&rsquo;s.</strong>{" "}
            They come from a deterministic engine over 24 cited rules. The server&rsquo;s own
            instructions tell the calling model, in as many words, that they are not its to rewrite,
            soften or overrule, and that it should show the shopper the reason rather than assert the
            conclusion in its own voice.
          </li>
          <li>
            <strong className="font-medium text-ink">
              An item it cannot read comes back UNKNOWN, never OK.
            </strong>{" "}
            That means the title named no active ingredient or strength, so no rule could apply. It
            is not a safety clearance, and the tool result says so in the same breath. The same goes
            for a cart with no findings: the corpus is finite.
          </li>
          <li>
            <strong className="font-medium text-ink">Nothing here writes anything.</strong> There is
            no tool that edits a rule, sets a verdict, spends a unit or keeps a profile, and a test
            asserts every tool carries <Key>readOnlyHint</Key>.
          </li>
          <li>
            <strong className="font-medium text-ink">One engine, not two.</strong> The judging is{" "}
            <Key>lib/check-cart.ts</Key>, which the extension&rsquo;s endpoint calls too, so a
            browser and an agent cannot drift apart.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="anim-reveal font-display text-2xl">If something goes wrong</h2>
        <dl className="mt-4 space-y-4 text-sm leading-relaxed">
          <div className="anim-reveal">
            <dt className="font-medium">The client connects but lists no tools</dt>
            <dd className="mt-1 text-muted">
              It is probably speaking the deprecated HTTP+SSE transport and opening with a{" "}
              <Key>GET</Key>, which this endpoint answers with 405. Use the stdio bridge in step
              three instead.
            </dd>
          </div>
          <div className="anim-reveal" style={{ "--i": 1 } as React.CSSProperties}>
            <dt className="font-medium">Every item comes back UNKNOWN</dt>
            <dd className="mt-1 text-muted">
              The titles are being paraphrased before they reach the tool. The rules key on active
              ingredients and strengths, so pass titles as the shop writes them &mdash; &ldquo;Retinol
              0.3% Night Serum&rdquo;, not &ldquo;a retinol serum&rdquo;.
            </dd>
          </div>
          <div className="anim-reveal" style={{ "--i": 2 } as React.CSSProperties}>
            <dt className="font-medium">Nothing fires even though the cart looks risky</dt>
            <dd className="mt-1 text-muted">
              Most rules key on the declared intake, so send one. Without an age band, a pregnancy
              status and the actives the shopper already uses, there is very little for the engine to
              decide on. Rules that key on a measurement need a <Key>scanLabel</Key> as well; call{" "}
              <code className="font-mono">list_scans</code> for the labels that exist.
            </dd>
          </div>
          <div className="anim-reveal" style={{ "--i": 3 } as React.CSSProperties}>
            <dt className="font-medium">A swap points at a product that is not in your shop</dt>
            <dd className="mt-1 text-muted">
              Swaps resolve against our fictional catalogue, because that is the only one we can
              price. Treat the returned name as the shape of the substitute &mdash; an azelaic acid
              cream rather than a retinoid &mdash; and match it to your own stock.
            </dd>
          </div>
        </dl>
      </section>

      <p className="mt-10 border-t border-line pt-6 text-sm leading-relaxed text-faint">
        <a
          className="underline underline-offset-2 hover:text-muted"
          href={`${REPO}/blob/main/docs/MCP.md`}
          target="_blank"
          rel="noreferrer"
        >
          docs/MCP.md
        </a>{" "}
        has the worked <code className="font-mono">curl</code> call, the protocol notes &mdash; the
        endpoint answers both the handshake-era revisions and the stateless 2026-07-28 one &mdash;
        and the one place it deliberately departs from the transport spec.
      </p>
    </div>
  );
}
