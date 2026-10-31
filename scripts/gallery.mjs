/**
 * Builds the Devpost gallery: a cover and five screenshots, 3:2, from the
 * running app.
 *
 *   node scripts/gallery.mjs [outDir]            against the deployed site
 *   BASE_URL=http://localhost:3000 node scripts/gallery.mjs
 *
 * Two passes. The first drives the real app and captures a pane of each screen,
 * including the extension running on a third-party shop. The second lays each
 * pane into a 1800x1200 frame with a heading, using the site's own tokens and
 * typefaces so the gallery and the product look like one thing.
 *
 * Nothing here is a mock-up. Every pane is the deployed app, so a figure in a
 * caption can be checked against the screenshot beside it.
 */
import { chromium } from "playwright";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "https://patchtest.fly.dev";
const OUT = path.resolve(process.argv[2] ?? "docs/gallery");
const WORK = mkdtempSync(path.join(tmpdir(), "pt-gallery-"));

/** 3:2, and twice the 900x600 Devpost renders at, so the type stays crisp. */
const CANVAS = { width: 1800, height: 1200 };
/** Where the screenshot sits in the frame. The text column takes the left. */
const WINDOW = { x: 860, y: 100, width: 940, height: 1100 };
/**
 * Every pane is clipped to the page's own content column and then to this
 * aspect, so it fills the window exactly: no dead gutter inside the shot, and
 * no letterbox around it. The viewport is tall enough for the tallest clip.
 */
const PANE_ASPECT = WINDOW.width / WINDOW.height;
const SHOT = { width: 1280, height: 1360 };
const GUTTER = 36;

const EXT_DIR = path.resolve(process.env.EXT_DIR ?? "extension");

const PANES = [
  {
    name: "results",
    route: "/check?preset=peel",
    ready: "h2:has-text('Your cart, checked')",
    column: "main > div",
    heading: "Your cart, checked",
    offset: 40,
  },
  {
    name: "scan",
    route: "/check?preset=peel",
    ready: "h2:has-text('Your scan')",
    column: "main > div",
    heading: "Your scan",
    offset: 40,
  },
  {
    name: "eval",
    route: "/eval",
    ready: "h2:has-text('Results')",
    column: "main > div",
    heading: "Results",
    offset: 40,
  },
  { name: "mcp", route: "/mcp", ready: "h1", column: "main > div", scrollTo: 0 },
];

/**
 * The five gallery screenshots. The cover is not here: it is generated art, and
 * `--with-cover` only rebuilds the composed fallback version of it.
 */
const COVER = {
  file: "thumbnail-composed.png",
  pane: "results",
  cover: true,
  label: "A patch test for your cart",
  title: "An AI skincare advisor that knows when <em>not</em> to sell",
  caption:
    "The model proposes the cart. A deterministic engine over 24 cited rules decides what the shopper should actually be allowed to buy.",
};

const FRAMES = [
  {
    file: "01-verdicts.png",
    pane: "results",
    label: "The verdict",
    title: "Every item gets a verdict, and a source",
    caption:
      "Four outcomes: not for you right now, adjust, you don&rsquo;t need this, worth showing a professional. Each one shows the rule that produced it, the measured score that triggered it, and a quote from the source behind it.",
  },
  {
    file: "02-two-numbers.png",
    pane: "scan",
    label: "The integration",
    title: "It shows the motivator, and decides on the measurement",
    caption:
      "The YouCam skin API returns two numbers per concern. <code>ui_score</code> is documented as a motivator; <code>raw_score</code> is the measurement. No rule may read the flattering one, and a test replaces every <code>ui_score</code> with nonsense to prove it.",
  },
  {
    file: "03-extension.png",
    pane: "extension",
    label: "Anywhere else",
    title: "The same rules, on somebody else&rsquo;s shop",
    caption:
      "A browser extension reads the cart on a shop&rsquo;s own page and parses each product title into active ingredients and strengths. A title it cannot read comes back as unread, never as cleared.",
  },
  {
    file: "04-eval.png",
    pane: "eval",
    label: "The evidence",
    title: "The comparison arm, reported honestly",
    caption:
      "Same model, same prompt, same inputs &mdash; only the guardrail differs. It left an item our labels call unsafe sitting in the cart in 22.5% of runs, and of the items needing a usage caveat it attached one to none of them.",
  },
  {
    file: "05-mcp.png",
    pane: "mcp",
    label: "For agents",
    title: "A guardrail an agent can call before it sells",
    caption:
      "PatchTest also runs as an MCP server: three read-only tools, no key, nothing to install. The verdicts still come from the rules engine, and the server tells the calling model they are not its to rewrite.",
  },
];

/** Clip to the page's own column, then to the window's aspect. */
async function clipFor(page, selector) {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width };
  }, selector);
  const x = Math.max(Math.round(box.left) - GUTTER, 0);
  const width = Math.min(Math.round(box.width) + GUTTER * 2, SHOT.width - x);
  return { x, y: 0, width, height: Math.round(width / PANE_ASPECT) };
}

async function capturePanes(browser) {
  for (const pane of PANES) {
    const page = await browser.newPage({ viewport: SHOT, deviceScaleFactor: 2 });
    await page.goto(BASE + pane.route, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(pane.ready, { timeout: 60000 });
    // Reveals fire on scroll, so everything has to be settled before the shot.
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      document.querySelectorAll(".anim-reveal").forEach((el) => el.classList.add("is-in"));
    });
    await page.waitForTimeout(900);
    await page.evaluate(
      ({ y, heading, offset }) => {
        if (heading) {
          const h = [...document.querySelectorAll("h2")].find((n) =>
            n.textContent.trim().startsWith(heading),
          );
          if (h) {
            window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - offset);
            return;
          }
        }
        window.scrollTo(0, y ?? 0);
      },
      { y: pane.scrollTo, heading: pane.heading, offset: pane.offset ?? 40 },
    );
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(WORK, `${pane.name}.png`),
      clip: await clipFor(page, pane.column),
    });
    console.log("pane  ", pane.name);
    await page.close();
  }
}

/** The extension needs its own browser, because it has to actually be installed. */
async function captureExtension() {
  const context = await chromium.launchPersistentContext(
    mkdtempSync(path.join(tmpdir(), "pt-gallery-ext-")),
    {
      headless: true,
      channel: "chromium",
      executablePath: process.env.CHROMIUM_FULL,
      viewport: SHOT,
      deviceScaleFactor: 2,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        `--disable-extensions-except=${EXT_DIR}`,
        `--load-extension=${EXT_DIR}`,
      ],
    },
  );
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(`${BASE}/store`, { waitUntil: "domcontentloaded" });
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 20000 });
    await worker.evaluate(async (apiBase) => {
      await chrome.storage.local.set({
        apiBase,
        profile: { intake: { pregnancy: "pregnant" }, scanLabel: "synthetic-02-acne" },
      });
    }, BASE);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".pt-badge", { timeout: 40000 });
    await page.waitForTimeout(1200);
    // Framed on the first flagged product rather than the top of the shop, so
    // the thing being demonstrated is the thing in shot.
    await page.evaluate(() => {
      const badge = document.querySelector(".pt-badge");
      const card = badge.closest("[itemtype]") ?? badge;
      window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 150);
    });
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(WORK, "extension.png"),
      clip: await clipFor(page, "body > div > div"),
    });
    console.log("pane   extension");
  } finally {
    await context.close();
  }
}

const esc = (s) => s.replace(/&(?!\w+;|#)/g, "&amp;");

function frameHtml(frame) {
  const cover = frame.cover;
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --paper: #fbfaf7; --surface: #fff; --ink: #191c1a; --muted: #5f6660; --faint: #6f756f;
    --accent: #2f5d4f; --line: rgb(25 28 26 / 0.09);
    --block: #a5342b; --block-soft: #fbedeb; --adjust: #8a5a14; --adjust-soft: #fdf3e2;
    --unnecessary: #4a5159; --unnecessary-soft: #f1f2f3; --refer: #2b5579; --refer-soft: #eaf1f8;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${CANVAS.width}px; height: ${CANVAS.height}px; overflow: hidden; position: relative;
    background: var(--paper); color: var(--ink);
    font-family: Geist, system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  }
  .text {
    position: absolute; left: 80px; top: 96px; width: 720px;
    display: flex; flex-direction: column;
  }
  .label {
    font-size: 19px; text-transform: uppercase; letter-spacing: 0.1em;
    font-weight: 500; color: var(--accent);
  }
  h1 {
    font-family: "Source Serif 4", Georgia, serif; font-weight: 400;
    letter-spacing: -0.015em; line-height: 1.05; text-wrap: balance;
    margin-top: 18px; font-size: ${cover ? "64px" : "48px"};
  }
  h1 em { font-style: normal; color: var(--accent); }
  .caption {
    margin-top: 22px; font-size: 23px; line-height: 1.55;
    color: var(--muted); text-wrap: pretty;
  }
  .caption code {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.88em; color: var(--ink);
    background: rgb(25 28 26 / 0.05); border-radius: 4px; padding: 1px 6px;
  }
  .chips { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; }
  .chip {
    font-size: 19px; font-weight: 500; padding: 8px 16px; border-radius: 999px;
    border: 1px solid; line-height: 1;
  }
  .b-block { color: var(--block); background: var(--block-soft); border-color: rgb(165 52 43 / 0.25); }
  .b-adjust { color: var(--adjust); background: var(--adjust-soft); border-color: rgb(138 90 20 / 0.25); }
  .b-unnec { color: var(--unnecessary); background: var(--unnecessary-soft); border-color: rgb(74 81 89 / 0.25); }
  .b-refer { color: var(--refer); background: var(--refer-soft); border-color: rgb(43 85 121 / 0.25); }

  .mark {
    position: absolute; left: 80px; bottom: 76px;
    font-size: 21px; color: var(--faint); line-height: 1.5;
  }
  .mark b { color: var(--ink); font-weight: 600; font-size: 24px; }

  /* The window bleeds off the right and bottom edges: a screenshot with a
     visible floor under it reads as a picture of an app, not as the app. */
  .window {
    position: absolute; left: ${WINDOW.x}px; top: ${WINDOW.y}px;
    width: ${WINDOW.width}px; height: ${WINDOW.height}px; overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--line); border-right: 0; border-bottom: 0;
    border-radius: 18px 0 0 0;
    box-shadow: -1px 1px 1px rgb(25 28 26 / .04), -8px 8px 18px rgb(25 28 26 / .05),
                -26px 26px 52px rgb(25 28 26 / .07);
  }
  .window img { width: 100%; display: block; }
</style></head>
<body>
  <div class="text">
    <p class="label">${esc(frame.label)}</p>
    <h1>${frame.title}</h1>
    <p class="caption">${frame.caption}</p>
    ${
      cover
        ? `<div class="chips">
             <span class="chip b-block">Not for you right now</span>
             <span class="chip b-adjust">Adjust</span>
             <span class="chip b-unnec">You don&rsquo;t need this</span>
             <span class="chip b-refer">Worth showing a professional</span>
           </div>`
        : ""
    }
  </div>
  <p class="mark"><b>PatchTest</b><br>patchtest.fly.dev</p>
  <div class="window"><img src="${frame.pane}.png" alt=""></div>
</body></html>`;
}

async function compose(browser) {
  mkdirSync(OUT, { recursive: true });
  const page = await browser.newPage({ viewport: CANVAS });
  for (const frame of FRAMES) {
    const html = path.join(WORK, `frame-${frame.file}.html`);
    writeFileSync(html, frameHtml(frame));
    await page.goto(`file://${html}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, frame.file) });
    console.log("frame ", frame.file);
  }
  await page.close();
}

if (process.argv.includes("--with-cover")) FRAMES.unshift(COVER);

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_FULL ? { executablePath: process.env.CHROMIUM_FULL } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  await capturePanes(browser);
  await captureExtension();
  await compose(browser);
  console.log(`\n${FRAMES.length} images in ${OUT}`);
} finally {
  await browser.close();
}
