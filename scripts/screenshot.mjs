/**
 * Screenshots the running app so the UI can actually be looked at.
 *   pnpm start   (in another shell)
 *   node scripts/screenshot.mjs [outDir]
 */
import { chromium } from "playwright";

const out = process.argv[2] ?? "/tmp/patchtest-shots";
const base = process.env.BASE_URL ?? "http://localhost:3000";

const pages = [
  ["landing", "/", 1280, 900, false],
  ["preset-pregnant", "/check?preset=pregnant", 1280, 1100, true],
  ["mobile-peel", "/check?preset=peel", 390, 844, true],
  ["methods", "/methods", 1280, 900, true],
  ["eval", "/eval", 1280, 900, true],
];

// Use whatever chromium this machine already has rather than downloading one.
const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
for (const [name, route, width, height, fullPage] of pages) {
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage });
    console.log("ok  ", name);
  } catch (err) {
    console.log("fail", name, err.message.split("\n")[0]);
  }
  await page.close();
}
await browser.close();
