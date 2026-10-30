/**
 * Runs real YouCam scans. Each image costs 22 units if both tasks succeed and
 * nothing if they fail. An image already recorded under the same label is served
 * from its fixture and costs nothing.
 *
 *   pnpm scan <image-path> [--label name]
 *   pnpm scan --all                        every file in fixtures/faces
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { budget, readLedger, SCAN_UNIT_COST, spent } from "../lib/ledger";
import { cachedScan, runScan } from "../lib/scan-runner";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));

const FACES_DIR = path.join(process.cwd(), "fixtures", "faces");

async function faceBank(): Promise<Array<{ imagePath: string; label: string }>> {
  const files = await readdir(FACES_DIR);
  return files
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort()
    .map((f) => ({ imagePath: path.join(FACES_DIR, f), label: f.replace(/\.[^.]+$/, "") }));
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");

  let targets: Array<{ imagePath: string; label: string }>;
  if (all) {
    targets = await faceBank();
  } else {
    const imagePath = args[0];
    if (!imagePath) {
      console.error("Usage: pnpm scan <image-path> [--label name]   |   pnpm scan --all");
      process.exit(1);
    }
    const flag = args.indexOf("--label");
    targets = [
      {
        imagePath,
        label: flag > -1 ? args[flag + 1] : path.basename(imagePath).replace(/\.[^.]+$/, ""),
      },
    ];
  }

  const before = spent(await readLedger());
  const state = await budget();
  console.log(`Units spent: ${before}. Scans today: ${state.scansToday}.`);
  console.log(`${targets.length} image(s) queued, up to ${targets.length * SCAN_UNIT_COST} units.\n`);

  const results: Array<{ label: string; status: string; detail: string }> = [];

  for (const [i, target] of targets.entries()) {
    const prefix = `[${i + 1}/${targets.length}] ${target.label}`;
    try {
      const { fixture, cached } = await runScan({
        ...target,
        onProgress: (step) => process.stdout.write(`\r${prefix}: ${step}`.padEnd(70)),
      });
      const s = fixture.summary;
      const scores = Object.entries(s.concerns)
        .map(([k, v]) => `${k}=${v.raw.toFixed(1)}`)
        .join(" ");
      process.stdout.write(`\r${prefix}: ${cached ? "cached" : "done"}`.padEnd(70) + "\n");
      console.log(`    fitz=${s.fitzpatrick} skin_type=${s.skinType.whole} age=${s.skinAge}`);
      console.log(`    ${scores}\n`);
      results.push({ label: target.label, status: cached ? "cached" : "scanned", detail: scores });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      process.stdout.write(`\r${prefix}: FAILED`.padEnd(70) + "\n");
      console.log(`    ${code ? `${code}: ` : ""}${message}\n`);
      results.push({ label: target.label, status: "failed", detail: code || message });
    }
  }

  const after = spent(await readLedger());
  console.log("=== SUMMARY ===");
  for (const r of results) console.log(`  ${r.status.padEnd(8)} ${r.label}`);
  console.log(`\nUnits spent this run: ${after - before}. Total: ${after}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
