/**
 * Loads the unpacked extension into a real browser and checks that it reads the
 * demo cart and writes verdicts onto the page.
 *   node scripts/test-extension.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const ext = path.resolve("extension");
const profileDir = mkdtempSync(path.join(tmpdir(), "pt-ext-"));

const context = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  channel: "chromium",
  executablePath: process.env.CHROMIUM_FULL,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--disable-extensions-except=${ext}`,
    `--load-extension=${ext}`,
  ],
});

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exitCode = 1;
};

try {
  const page = await context.newPage();

  // Point the extension at the local server and give it a profile, the way the
  // site would after a scan.
  await page.goto(`${base}/store`, { waitUntil: "domcontentloaded" });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  if (!worker) throw new Error("extension service worker did not start");
  console.log("service worker up");

  await worker.evaluate(async (apiBase) => {
    await chrome.storage.local.set({
      apiBase,
      profile: { intake: { pregnancy: "pregnant" }, scanLabel: "synthetic-02-acne" },
    });
  }, base);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".pt-badge", { timeout: 25000 });
  await page.waitForTimeout(800);

  const badges = await page.$$eval(".pt-badge", (nodes) =>
    nodes.map((n) => ({
      verdict: n.querySelector(".pt-badge-head")?.textContent?.trim(),
      item: n.closest("[itemtype]")?.querySelector('[itemprop="name"]')?.textContent?.trim(),
      hasSource: Boolean(n.querySelector(".pt-badge-link")),
    })),
  );
  const panel = await page.$eval(".pt-panel", (n) => n.textContent.replace(/\s+/g, " ").trim());

  console.log(`${badges.length} verdicts injected onto the shop page:`);
  for (const b of badges) console.log(`  ${b.verdict}  ${b.item}  source=${b.hasSource}`);
  console.log(`panel: ${panel}`);

  if (badges.length < 2) fail("expected the retinol and the peel to be flagged");
  if (!badges.some((b) => b.verdict === "Not for you right now")) fail("expected a block verdict");
  if (!badges.every((b) => b.hasSource || b.verdict === "Could not read this")) {
    fail("every verdict should cite a source");
  }

  await page.screenshot({
    path: process.env.SHOT || "/tmp/pt-extension.png",
    fullPage: true,
  });
  console.log("screenshot written");
} catch (err) {
  fail(err.message);
} finally {
  await context.close();
}
