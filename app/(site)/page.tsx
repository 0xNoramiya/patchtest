import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import { PRESETS } from "@/lib/presets";
import { loadCatalog, productBySku } from "@/lib/rules/load";

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
        <p className="label text-accent">A patch test for your cart</p>
        <h1 className="mt-3 text-[2.6rem] leading-[1.05] sm:text-6xl">
          An AI skincare advisor that knows when <em className="not-italic text-accent">not</em> to
          sell you something.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          PatchTest sits at the moment before checkout. It scans your skin, reads what you told us,
          and gives every item in your cart one of four verdicts, each with a source you can click.
          The AI proposes. The rules decide.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
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
        {STEPS.map((step) => (
          <div key={step.n} className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft font-display text-sm text-accent">
              {step.n}
            </span>
            <h2 className="mt-1 font-display text-lg leading-snug">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl">Try a real one</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Each of these replays a scan that really was run through the YouCam APIs, paired with a
          declared intake. No photo here belongs to a real person, and no minor was ever scanned:
          the age on the first one is declared, not read off the face.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {PRESETS.map((preset) => (
            <li key={preset.id}>
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

      <section className="mt-14 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-7">
        <h2 className="font-display text-2xl">Why this needs to exist</h2>
        <dl className="mt-5 grid gap-6 sm:grid-cols-3">
          <div>
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
          <div>
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
          <div>
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
