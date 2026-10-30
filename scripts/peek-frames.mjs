/**
 * Screenshots the composition at given times, without rendering it.
 *
 * A full render is about twelve minutes, which is far too slow a loop for
 * checking whether a layout is right. This loads video/demo/index.html, seeks
 * the GSAP timeline, and emulates the one thing the player does that the raw
 * page does not — hiding clips outside their window — so the frame matches
 * what the render will produce.
 *
 *   node scripts/peek-frames.mjs <outDir> <seconds...>
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const out = process.argv[2];
const times = process.argv.slice(3).map(Number);
if (!out || times.length === 0) {
  console.error("usage: node scripts/peek-frames.mjs <outDir> <seconds...>");
  process.exit(1);
}
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_FULL ? { executablePath: process.env.CHROMIUM_FULL } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("console", (m) => { if (m.type() === "error") console.error("  page error:", m.text()); });
page.on("pageerror", (e) => console.error("  page threw:", e.message));
page.on("requestfailed", (r) => console.error("  request failed:", r.url(), r.failure()?.errorText));
// Over http, not file://: the composition loads GSAP from a CDN, and a
// file:// origin cannot fetch it.
const url = process.env.PEEK_URL ?? "http://localhost:8777/index.html";
// domcontentloaded, not load: the <audio> elements never finish fetching
// outside the player, so the load event does not fire.
await page.goto(url, { waitUntil: "domcontentloaded" });
// waitForFunction polls on requestAnimationFrame, which this page does not
// drive, so it never resolves. A fixed settle plus an explicit check is both
// simpler and reliable here.
await page.waitForTimeout(2500);
const ready = await page.evaluate("typeof window.gsap === 'object' && !!(window.__timelines && window.__timelines.main)");
if (!ready) throw new Error("composition did not initialise: gsap or window.__timelines.main is missing");

for (const t of times) {
  await page.evaluate((tt) => {
    window.__timelines.main.seek(tt);
    for (const el of document.querySelectorAll("[data-start]")) {
      if (el.id === "root") continue;
      const s = parseFloat(el.dataset.start);
      const d = parseFloat(el.dataset.duration ?? "0");
      el.style.visibility = tt >= s - 0.001 && tt <= s + d + 0.001 ? "visible" : "hidden";
    }
  }, t);
  await page.waitForTimeout(160);
  await page.screenshot({ path: path.join(out, `t${String(t).padStart(6, "0")}.png`) });
  console.log(`  ${t}s`);
}
await browser.close();
