import Link from "next/link";
import { CopyCommand } from "@/components/CopyCommand";
import { ProductImage } from "@/components/ProductImage";
import { TOOLS } from "@/lib/mcp/tools";
import { PRESETS } from "@/lib/presets";
import { loadCatalog, productBySku } from "@/lib/rules/load";

const MCP_ENDPOINT = "https://patchtest.fly.dev/api/mcp";

/** Short enough for a card. The names come from the server itself. */
const TOOL_LINE: Record<string, string> = {
  check_cart: "A verdict per item, with the rule and the source behind it.",
  list_rules: "All 24 cited rules, caveats included.",
  list_scans: "The recorded scans a check can be judged against.",
};

const STEPS = [
  { n: "1", title: "A 30 second intake", body: "Age band, pregnancy, medication, and the signs you have noticed. You tell us. We never read it off your face." },
  { n: "2", title: "One selfie, two scans", body: "YouCam AI Skin Analysis measures eight concerns. YouCam AI Fitzpatrick Skin Type Analysis reads your skin tone." },
  { n: "3", title: "Every item gets a verdict", body: "An AI proposes a routine. A rules engine with cited sources decides what you should actually be allowed to buy." },
];

export default function Home() {
  const catalog = loadCatalog();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <section className="max-w-2xl">
        <p className="anim-hero label text-accent">A patch test for your cart</p>
        <h1
          className="anim-hero mt-3 text-[2.6rem] leading-[1.05] sm:text-6xl"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          An AI skincare advisor that knows when <em className="not-italic text-accent">not</em> to
          sell you something.
        </h1>
        <p
          className="anim-hero mt-5 text-lg leading-relaxed text-muted"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          PatchTest sits at the moment before checkout. It scans your skin, reads what you told us,
          and gives every item in your cart one of four verdicts, each with a source you can click.
          The AI proposes. The rules decide.
        </p>
        <div
          className="anim-hero mt-7 flex flex-wrap gap-3"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <Link
            href="/check"
            className="press rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90"
          >
            Check a cart
          </Link>
          <Link
            href="/methods"
            className="press rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:border-accent"
          >
            How it decides
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.n}
            className="anim-reveal rounded-xl border border-line bg-surface p-5 shadow-card"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft font-display text-sm text-accent">
              {step.n}
            </span>
            <h2 className="mt-1 font-display text-lg leading-snug">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="anim-reveal font-display text-2xl">Try a real one</h2>
        <p className="anim-reveal mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Each of these replays a scan that really was run through the YouCam APIs, paired with a
          declared intake. No photo here belongs to a real person, and no minor was ever scanned:
          the age on the first one is declared, not read off the face.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {PRESETS.map((preset, i) => (
            <li key={preset.id} className="anim-reveal" style={{ "--i": i } as React.CSSProperties}>
              <Link
                href={`/check?preset=${preset.id}`}
                className="press group flex h-full gap-4 rounded-xl border border-line bg-surface p-4 shadow-card hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-raised"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/fixture/scans/${preset.scanLabel}/input.jpg`}
                  alt=""
                  width={80}
                  height={96}
                  className="h-24 w-20 shrink-0 rounded-lg bg-sunken object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg leading-snug">{preset.title}</h3>
                  <p className="mt-1 text-sm leading-snug text-muted">{preset.blurb}</p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="label text-faint">In the cart</span>
                    <span className="flex -space-x-1.5">
                      {preset.wantedSkus.map((sku) => {
                        const product = productBySku(catalog, sku);
                        return product ? (
                          <ProductImage
                            key={sku}
                            sku={sku}
                            name={product.name}
                            size={24}
                            className="ring-2 ring-surface"
                          />
                        ) : null;
                      })}
                    </span>
                    <span className="ml-auto text-sm font-medium text-accent group-hover:underline">
                      Run it
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="anim-reveal font-display text-2xl">Or let an agent do the checking</h2>
        <p className="anim-reveal mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The same guardrail runs as an MCP server, so anything that speaks the protocol can send it
          a cart and get back a verdict per item before it recommends, adds or buys anything. No key,
          no account, nothing to install, and every tool is read-only.
        </p>
        <div className="anim-reveal mt-5 max-w-2xl">
          <CopyCommand
            command={`claude mcp add --transport http patchtest ${MCP_ENDPOINT}`}
            label="Claude Code, one line"
          />
        </div>
        <p className="anim-reveal mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Claude Desktop, Cursor, VS Code, or anything else that takes an HTTP MCP server: paste{" "}
          <code className="font-mono text-[0.8125rem] text-ink">{MCP_ENDPOINT}</code>.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {TOOLS.map((tool, i) => (
            <li
              key={tool.name}
              className="anim-reveal rounded-xl border border-line bg-surface p-4 shadow-card"
              style={{ "--i": i } as React.CSSProperties}
            >
              <code className="font-mono text-sm font-medium text-accent">{tool.name}</code>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {TOOL_LINE[tool.name] ?? tool.title}
              </p>
            </li>
          ))}
        </ul>
        <p className="anim-reveal mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/mcp" className="font-medium text-accent hover:underline">
            Full setup, a worked call and the protocol notes
          </Link>
          <Link href="/extension" className="text-muted hover:text-ink">
            Or the browser extension, to check a cart on a shop yourself
          </Link>
        </p>
      </section>

      <section className="mt-14 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-7">
        <h2 className="anim-reveal font-display text-2xl">Why this needs to exist</h2>
        <dl className="mt-5 grid gap-6 sm:grid-cols-3">
          <div className="anim-reveal">
            <dt className="font-display text-3xl text-accent">11</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              potentially irritating active ingredients in the average top-viewed children&rsquo;s
              skincare video on TikTok. Only 26% of daytime routines included sunscreen.{" "}
              <a
                className="text-accent underline underline-offset-2"
                href="https://www.sciencedaily.com/releases/2025/06/250609054355.htm"
                target="_blank"
                rel="noreferrer"
              >
                Pediatrics, 2025
              </a>
            </dd>
          </div>
          <div className="anim-reveal" style={{ "--i": 1 } as React.CSSProperties}>
            <dt className="font-display text-3xl text-accent">5&ndash;13.5%</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              of answers to patient-posed medical questions were rated unsafe across four major
              language models, measured in late 2024.{" "}
              <a
                className="text-accent underline underline-offset-2"
                href="https://pmc.ncbi.nlm.nih.gov/articles/PMC13013898/"
                target="_blank"
                rel="noreferrer"
              >
                npj Digital Medicine, 2026
              </a>
            </dd>
          </div>
          <div className="anim-reveal" style={{ "--i": 2 } as React.CSSProperties}>
            <dt className="font-display text-3xl text-accent">Held</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              California AB 2491 would have barred selling retinoids and acids to under-13s. It died
              in committee in May 2024, so no store has to do this.{" "}
              <a
                className="text-accent underline underline-offset-2"
                href="https://calmatters.digitaldemocracy.org/bills/CA_202320240AB2491"
                target="_blank"
                rel="noreferrer"
              >
                AB 2491
              </a>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
