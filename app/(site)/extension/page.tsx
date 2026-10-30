import { readFileSync } from "node:fs";

export const metadata = {
  title: "Install the extension | PatchTest",
  description:
    "Load the PatchTest browser extension and check a skincare cart on any shop, not just ours.",
};

const REPO = "https://github.com/0xNoramiya/patchtest";

/** Read from the manifest the zip is built from, so the link cannot go stale. */
function extensionVersion(): string {
  const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8")) as {
    version: string;
  };
  return manifest.version;
}

function Step({
  n,
  title,
  last,
  children,
}: {
  n: number;
  title: string;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4">
      {/* The rail joins a step to the next one, so the last step has none. It is
          decorative, so it must never eat a click. */}
      {last ? null : (
        <span
          aria-hidden
          className="absolute left-[15px] top-9 h-[calc(100%-12px)] w-px bg-line"
        />
      )}
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-medium tabular-nums">
        {n}
      </span>
      <div className="min-w-0 pb-7">
        <h3 className="text-[15px] font-medium leading-8">{title}</h3>
        {children ? (
          <div className="mt-1 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
        ) : null}
      </div>
    </li>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-line bg-sunken px-1.5 py-0.5 text-[0.8125rem] text-ink">
      {children}
    </code>
  );
}

export default function ExtensionPage() {
  const version = extensionVersion();
  const zip = `${REPO}/releases/latest/download/patchtest-extension-v${version}.zip`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="label text-faint">Browser extension</p>
      <h1 className="mt-2 font-display text-4xl">Check a cart on someone else&rsquo;s shop</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        The web app answers &ldquo;is this cart right for me&rdquo; inside PatchTest. The extension
        answers it where people actually shop. It reads the cart on a shop&rsquo;s own page, matches
        each product title to its active ingredients and strengths, and applies the same cited rules
        there.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <a
          href={zip}
          className="press rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          Download the extension
        </a>
        <span className="text-sm text-faint tabular-nums">
          v{version} &middot; zip &middot; Chrome, Edge, Brave, Arc
        </span>
      </div>

      <p className="mt-4 rounded-lg border border-line bg-sunken px-4 py-3 text-sm leading-relaxed text-muted">
        It is not on the Chrome Web Store, so it loads unpacked. That is the normal way to run an
        unlisted extension and takes about thirty seconds. Nothing to configure, and no account.
      </p>

      <section className="mt-11">
        <h2 className="font-display text-2xl">Install it</h2>
        <ol className="mt-5">
          <Step n={1} title="Download the zip and unzip it">
            <p>
              <a className="text-accent underline underline-offset-2" href={zip}>
                patchtest-extension-v{version}.zip
              </a>
              . Unzip it somewhere you will not delete by accident &mdash; the browser loads the
              extension from this folder every time it starts, so moving or binning it later
              uninstalls it.
            </p>
          </Step>
          <Step n={2} title="Open your browser’s extensions page">
            <p>
              Paste <Key>chrome://extensions</Key> into the address bar and press Enter. On Edge it
              is <Key>edge://extensions</Key>, on Brave <Key>brave://extensions</Key>. A link will
              not work here; it has to be typed or pasted.
            </p>
          </Step>
          <Step n={3} title="Turn on Developer mode">
            <p>
              The toggle sits in the top-right corner of that page. Without it, the Load unpacked
              button in the next step does not appear.
            </p>
          </Step>
          <Step n={4} title="Press Load unpacked, and pick the unzipped folder">
            <p>
              Choose the folder itself, not a file inside it. It is the one containing{" "}
              <Key>manifest.json</Key>. PatchTest now appears in your extensions list.
            </p>
          </Step>
          <Step n={5} last title="Pin it to the toolbar (optional)">
            <p>
              Press the puzzle-piece icon beside the address bar and pin PatchTest, so the check
              button is one click away on any shop.
            </p>
          </Step>
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">Use it</h2>
        <ol className="mt-5">
          <Step n={1} title="Give it a profile to work from">
            <p>
              Run any preset or a scan of your own on{" "}
              <a className="text-accent underline underline-offset-2" href="/check">
                the check page
              </a>
              . The results page leaves your profile in this browser for the extension to pick up.
              Until you do this, the extension has nothing to judge a cart against and will say so.
            </p>
          </Step>
          <Step n={2} title="Open a cart">
            <p>
              <a className="text-accent underline underline-offset-2" href="/store">
                Verdant Row
              </a>{" "}
              is a second fictional shop built for exactly this, with a deliberately awkward cart in
              it. The extension annotates the cart in place.
            </p>
          </Step>
          <Step n={3} last title="Run it anywhere else">
            <p>
              On any other shop, press the toolbar icon and then <strong>Check this page</strong>.
              It reads product titles out of the page and returns a verdict for each one it can
              parse.
            </p>
          </Step>
        </ol>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-card">
        <h2 className="font-display text-xl">What it sends, and what it does not</h2>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted">
          <li>
            <strong className="font-medium text-ink">No photo ever leaves your machine.</strong> The
            extension never touches your scan image. Your profile is your declared intake plus the
            label of your recorded scan, and it stays in the browser&rsquo;s own storage until you
            press check.
          </li>
          <li>
            <strong className="font-medium text-ink">It only reads a page when you ask.</strong>{" "}
            There is no background scraping and no tracking. On the demo shop it annotates the cart
            on load; everywhere else it waits for the button.
          </li>
          <li>
            <strong className="font-medium text-ink">
              A title it cannot read never comes back &ldquo;OK&rdquo;.
            </strong>{" "}
            It says it could not read the product, and says plainly that this is not a safety
            clearance. The parser does not guess.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">If something goes wrong</h2>
        <dl className="mt-4 space-y-4 text-sm leading-relaxed">
          <div>
            <dt className="font-medium">The Load unpacked button is missing</dt>
            <dd className="mt-1 text-muted">
              Developer mode is still off, or you are on a browser that is not Chromium-based.
              Safari and Firefox use different extension formats and this build will not load in
              them.
            </dd>
          </div>
          <div>
            <dt className="font-medium">It says it has no profile</dt>
            <dd className="mt-1 text-muted">
              Run a preset on the check page first, in the same browser profile. A different browser
              profile, or a private window, has its own storage and will not see it.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Nothing appears on a shop&rsquo;s cart</dt>
            <dd className="mt-1 text-muted">
              Press the toolbar icon and <strong>Check this page</strong>. If the products still get
              no verdict, the shop&rsquo;s titles do not name an active ingredient or a strength,
              which is the one thing the rules key on.
            </dd>
          </div>
          <div>
            <dt className="font-medium">The extension disappeared after a restart</dt>
            <dd className="mt-1 text-muted">
              The unzipped folder was moved or deleted. Put it back, or load it unpacked again.
            </dd>
          </div>
        </dl>
      </section>

      <p className="mt-10 border-t border-line pt-6 text-sm leading-relaxed text-faint">
        The source is in{" "}
        <a
          className="underline underline-offset-2 hover:text-muted"
          href={`${REPO}/tree/main/extension`}
          target="_blank"
          rel="noreferrer"
        >
          the repository
        </a>{" "}
        if you would rather read it before running it, or load that folder directly instead of the
        zip.
      </p>
    </div>
  );
}
