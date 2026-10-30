/**
 * Records the app for the demo video. Each clip is sized to the narration block
 * it plays under, read from media/voiceover/manifest.json, so the picture never
 * runs out before the voice does.
 *
 *   node scripts/record-clips.mjs [--only <id>]
 *
 * Playwright writes webm; ffmpeg converts to mp4 for the composition.
 */
import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "media/clips";
const RAW = "media/clips/.raw";

// recordVideo captures the page at its CSS viewport size, so the viewport has
// to BE the frame. The page is then zoomed so the app's 1024px content column
// fills it, rather than sitting in a sea of whitespace at video scale.
const VIDEO = { width: 1920, height: 1080 };
const VIEWPORT = VIDEO;
// 1.6 keeps the CSS viewport at 1200px, comfortably above Tailwind's lg
// breakpoint, so the layout stays the desktop one the judges will see.
const ZOOM = 1.6;

const pad = (s) => new Promise((r) => setTimeout(r, s * 1000));

/** Each clip's job, and the narration block it has to cover. */
const CLIPS = [
  {
    id: "preset-pregnant", block: "02",
    async act(page) {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await pad(1.5);
      await page.getByRole("link", { name: /Eight weeks pregnant/ }).click();
      await page.waitForSelector("text=What we found", { timeout: 30000 });
      await pad(1.5);
      await page.mouse.wheel(0, 420);
      await pad(5);
      await page.mouse.wheel(0, 320);
      await pad(5);
    },
  },
  {
    id: "preset-peel", block: "03",
    async act(page) {
      await page.goto(`${BASE}/check?preset=peel`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("text=What we found", { timeout: 30000 });
      await pad(2);
      await page.mouse.wheel(0, 380);
      await pad(5);
      await page.locator("h2", { hasText: "Your scan" }).scrollIntoViewIfNeeded();
      await pad(2);
      await page.getByRole("button", { name: "Texture" }).click();
      await pad(6);
    },
  },
  {
    id: "preset-refer", block: "04",
    async act(page) {
      await page.goto(`${BASE}/check?preset=refer`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("text=What we found", { timeout: 30000 });
      await pad(3);
      await page.mouse.wheel(0, 300);
      await pad(5);
      await page.mouse.wheel(0, 320);
      await pad(5);
    },
  },
  {
    id: "methods", block: "06",
    async act(page) {
      await page.goto(`${BASE}/methods`, { waitUntil: "domcontentloaded" });
      await pad(2);
      for (let i = 0; i < 6; i += 1) {
        await page.mouse.wheel(0, 300);
        await pad(1.6);
      }
      await page.locator("summary").first().click().catch(() => {});
      await pad(6);
    },
  },
  {
    id: "eval", block: "07",
    async act(page) {
      await page.goto(`${BASE}/eval`, { waitUntil: "domcontentloaded" });
      await pad(3);
      for (let i = 0; i < 14; i += 1) {
        await page.mouse.wheel(0, 260);
        await pad(2.2);
      }
      await pad(4);
    },
  },
];

/** The extension only exists in a persistent context, so this clip is its own path. */
async function recordExtension(seconds) {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const ext = path.resolve("extension");
  const profile = mkdtempSync(path.join(tmpdir(), "pt-vid-"));

  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.CHROMIUM_FULL,
    viewport: VIEWPORT,
    recordVideo: { dir: RAW, size: VIDEO },
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars",
      `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  await context.addInitScript((zoom) => {
    const apply = () => { document.documentElement.style.zoom = String(zoom); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
    else apply();
  }, ZOOM);

  const page = await context.newPage();
  await page.goto(`${BASE}/store`, { waitUntil: "domcontentloaded" });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  await worker.evaluate(async (apiBase) => {
    await chrome.storage.local.set({
      apiBase,
      profile: { intake: { pregnancy: "pregnant" }, scanLabel: "synthetic-09-olive" },
    });
  }, BASE);

  const started = Date.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".pt-badge", { timeout: 30000 });
  await pad(5);
  await page.mouse.wheel(0, 260);
  await pad(5);
  await page.mouse.wheel(0, 260);
  await pad(5);
  const short = seconds + 1.2 - (Date.now() - started) / 1000;
  if (short > 0) await pad(short);
  await page.close();
  await context.close();
  return true;
}

async function main() {
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
  const manifest = JSON.parse(await readFile("media/voiceover/manifest.json", "utf8"));
  const secondsFor = (block) =>
    manifest.clips.find((c) => c.file.startsWith(block))?.seconds ?? 0;

  await mkdir(RAW, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_FULL,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
  });

  const convert = async (id, need) => {
    const webm = (await readdir(RAW)).filter((f) => f.endsWith(".webm")).map((f) => path.join(RAW, f));
    const newest = webm.sort().at(-1);
    const mp4 = path.join(OUT, `${id}.mp4`);
    await run("ffmpeg", ["-y", "-i", newest, "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      "-pix_fmt", "yuv420p", "-r", "30", "-an", mp4]);
    await rm(newest);
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]);
    console.log(`  ${id.padEnd(18)} ${Number(stdout).toFixed(1)}s  (narration needs ${need.toFixed(1)}s)`);
  };

  if (!only || only === "extension") {
    const need = secondsFor("05");
    await recordExtension(need);
    await convert("extension", need);
  }

  for (const clip of CLIPS) {
    if (only && clip.id !== only) continue;
    const need = secondsFor(clip.block);
    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: { dir: RAW, size: VIDEO },
      reducedMotion: "no-preference",
    });
    await context.addInitScript((zoom) => {
      const apply = () => {
        document.documentElement.style.zoom = String(zoom);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply, { once: true });
      } else {
        apply();
      }
    }, ZOOM);
    const page = await context.newPage();
    const started = Date.now();
    await clip.act(page);
    // Hold the last frame until the narration for this block is covered.
    const short = need + 1.2 - (Date.now() - started) / 1000;
    if (short > 0) await pad(short);
    await page.close();
    await context.close();

    await convert(clip.id, need);
  }

  await browser.close();
  await rm(RAW, { recursive: true, force: true });
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
