import Link from "next/link";
import { PRESETS } from "@/lib/presets";

const STEPS = [
  { n: "1", title: "A 30 second intake", body: "Age band, pregnancy, medication, and the signs you have noticed. You tell us. We never read it off your face." },
  { n: "2", title: "One selfie, two scans", body: "YouCam AI Skin Analysis measures eight concerns. YouCam AI Fitzpatrick Skin Type Analysis reads your skin tone." },
  { n: "3", title: "Every item gets a verdict", body: "An AI proposes a routine. A rules engine with cited sources decides what you should actually be allowed to buy." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <section className="max-w-2xl">
        <p className="text-sm uppercase tracking-widest text-accent">A patch test for your cart</p>
        <h1 className="mt-3 text-4xl leading-[1.1] sm:text-5xl">
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
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Check a cart
          </Link>
          <Link
            href="/methods"
            className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:border-accent"
          >
            How it decides
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.n} className="rounded-xl border border-line bg-surface p-5">
            <span className="font-display text-sm text-accent">{step.n}</span>
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
                className="block h-full rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent"
              >
                <h3 className="font-display text-lg leading-snug">{preset.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{preset.blurb}</p>
                <p className="mt-3 text-sm font-medium text-accent">Run this one</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 rounded-xl border border-line bg-surface p-5 sm:p-7">
        <h2 className="font-display text-2xl">Why this needs to exist</h2>
        <dl className="mt-5 grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="font-display text-3xl text-accent">11</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              potentially irritating active ingredients in the average top-viewed children&rsquo;s
              skincare routine on TikTok. Only 26% of daytime routines included sunscreen.{" "}
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
