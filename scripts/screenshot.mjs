/**
 * Screenshots the running app for the README.
 *   pnpm preview   (in another shell)
 *   node scripts/screenshot.mjs [outDir]
 */
import { chromium } from "playwright";

const out = process.argv[2] ?? "docs/screenshots";
const base = process.env.BASE_URL ?? "http://localhost:3000";

const shots = [
  { name: "landing", route: "/", width: 1280, height: 860, full: false },
  { name: "results", route: "/check?preset=peel", width: 1180, height: 1400, full: false },
  { name: "scan", route: "/check?preset=pregnant", width: 1180, height: 900, full: false, clip: ".font-display + div, section:has(h2)" },
  { name: "eval", route: "/eval", width: 1180, height: 1250, full: false },
  { name: "methods", route: "/methods", width: 1180, height: 1000, full: false },
  { name: "mobile", route: "/check?preset=tiktok", width: 390, height: 1100, full: false },
  { name: "store", route: "/store", width: 1180, height: 760, full: false },
];

// Use whatever chromium this machine already has rather than downloading one.
const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
  });
  try {
    await page.goto(base + shot.route, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${out}/${shot.name}.png`, fullPage: shot.full });
    console.log("ok  ", shot.name);
  } catch (err) {
    console.log("fail", shot.name, err.message.split("\n")[0]);
  }
  await page.close();
}
await browser.close();
