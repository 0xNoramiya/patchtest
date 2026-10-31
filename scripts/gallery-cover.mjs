/**
 * Builds the gallery cover: generated art, with the pitch set over it.
 *
 *   node scripts/gallery-cover.mjs <art.png> [outPath]
 *
 * The art comes from Higgsfield and is composed with its left half empty so the
 * type has somewhere to live. The type is set here rather than asked of the
 * image model: a cover has to spell a long headline correctly and sit in the
 * product's own typefaces, and neither is something to leave to a sampler.
 *
 * The art is 1024x688, which is 1.488 rather than 1.5, so the largest exact-3:2
 * rectangle is taken out of the middle. Nothing is stretched: an image that has
 * to be squashed to meet a ratio is the wrong image.
 *
 * The resize is a plain Lanczos one and not a model upscale on purpose. The 2K
 * upscale of an earlier cover came back with scrawled lettering hallucinated
 * into the blank paper - faint, but it read as handwriting, and invented text on
 * a submission cover is worse than a slightly softer one.
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const src = process.argv[2];
const out = path.resolve(process.argv[3] ?? "docs/gallery/thumbnail.png");
if (!src) {
  console.error("usage: node scripts/gallery-cover.mjs <art.png> [outPath]");
  process.exit(1);
}

const CANVAS = { width: 1800, height: 1200 };
const WORK = mkdtempSync(path.join(tmpdir(), "pt-cover-"));
const art = path.join(WORK, "art.png");

const image = sharp(src);
const { width, height } = await image.metadata();
const ratio = CANVAS.width / CANVAS.height;
const cropWidth = Math.min(width, Math.round(height * ratio));
const cropHeight = Math.min(height, Math.round(width / ratio));

await image
  .extract({
    left: Math.round((width - cropWidth) / 2),
    top: Math.round((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  })
  .resize(CANVAS.width, CANVAS.height, { fit: "fill", kernel: "lanczos3" })
  .png({ compressionLevel: 9 })
  .toFile(art);

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #191c1a; --muted: #4d534e; --accent: #2f5d4f;
    --block: #a5342b; --block-soft: #fbedeb; --adjust: #8a5a14; --adjust-soft: #fdf3e2;
    --unnecessary: #4a5159; --unnecessary-soft: #f1f2f3; --refer: #2b5579; --refer-soft: #eaf1f8;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${CANVAS.width}px; height: ${CANVAS.height}px; overflow: hidden; position: relative;
    font-family: Geist, system-ui, sans-serif; color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }
  .art { position: absolute; inset: 0; }
  .art img { width: 100%; height: 100%; display: block; }

  /* Sized for the gallery grid, not for this file. At the ~460px a Devpost card
     renders, everything here is quartered, so anything under about 26px at full
     size is decoration rather than copy. That is the whole reason the sub-line
     is one sentence: the fewer words, the bigger they can be. */
  .copy { position: absolute; left: 92px; top: 92px; width: 860px; }

  .wordmark {
    font-family: "Source Serif 4", Georgia, serif; font-size: 48px; font-weight: 600;
    letter-spacing: -0.012em; color: var(--ink);
  }
  .wordmark span { color: var(--accent); }

  h1 {
    font-family: "Source Serif 4", Georgia, serif; font-weight: 400;
    font-size: 100px; line-height: 1.02; letter-spacing: -0.022em;
    margin-top: 30px; text-wrap: balance;
  }
  h1 em { font-style: normal; color: var(--accent); }

  .thesis {
    margin-top: 32px; font-size: 36px; line-height: 1.35; color: var(--muted);
    text-wrap: pretty;
  }

  /* One row, so the four verdicts read as the set they are rather than as three
     and a straggler. */
  .chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 40px; }
  .chip {
    font-size: 27px; font-weight: 500; padding: 13px 22px; border-radius: 999px;
    border: 1.5px solid; line-height: 1; white-space: nowrap;
  }
  .b-block { color: var(--block); background: var(--block-soft); border-color: rgb(165 52 43 / 0.3); }
  .b-adjust { color: var(--adjust); background: var(--adjust-soft); border-color: rgb(138 90 20 / 0.3); }
  .b-unnec { color: var(--unnecessary); background: var(--unnecessary-soft); border-color: rgb(74 81 89 / 0.3); }
  .b-refer { color: var(--refer); background: var(--refer-soft); border-color: rgb(43 85 121 / 0.3); }

  .foot {
    position: absolute; left: 92px; bottom: 84px; font-size: 28px; line-height: 1.5;
    color: var(--muted);
  }
  .foot b { color: var(--ink); font-weight: 600; font-size: 34px; }
</style></head>
<body>
  <div class="art"><img src="art.png" alt=""></div>
  <div class="copy">
    <p class="wordmark">Patch<span>Test</span></p>
    <h1>An AI skincare advisor that knows when <em>not</em> to sell</h1>
    <p class="thesis">The model proposes the cart. 24&nbsp;cited rules decide.</p>
    <div class="chips">
      <span class="chip b-block">Not for you right now</span>
      <span class="chip b-adjust">Adjust</span>
      <span class="chip b-unnec">You don&rsquo;t need this</span>
      <span class="chip b-refer">Worth showing a professional</span>
    </div>
  </div>
  <p class="foot">
    <b>patchtest.fly.dev</b><br>
    Built on the YouCam AI Skin Analysis and AI Fitzpatrick Skin Type APIs
  </p>
</body></html>`;

const page_html = path.join(WORK, "cover.html");
writeFileSync(page_html, html);

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_FULL ? { executablePath: process.env.CHROMIUM_FULL } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: CANVAS });
await page.goto(`file://${page_html}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: out });
await browser.close();

const after = await sharp(out).metadata();
console.log(
  `${width}x${height} art -> ${after.width}x${after.height} (${(after.width / after.height).toFixed(4)})  ${out}`,
);
