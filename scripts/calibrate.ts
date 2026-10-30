/**
 * Prints the raw_score distribution across the recorded scan bank, so the
 * thresholds in rules/thresholds.json are set against real numbers rather than
 * guesses. Reads fixtures only. Spends nothing.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { SCORED_CONCERNS, type ScanSummary } from "../lib/youcam/parse";
import { loadThresholds } from "../lib/rules/load";

type Fixture = { label: string; summary: ScanSummary };

async function main() {
  const dir = path.join(process.cwd(), "fixtures", "scans");
  const labels = (await readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const fixtures: Fixture[] = [];
  for (const label of labels) {
    const raw = JSON.parse(await readFile(path.join(dir, label, "fixture.json"), "utf8"));
    if (raw.summary) fixtures.push({ label, summary: raw.summary });
  }

  const t = loadThresholds();
  console.log(`${fixtures.length} recorded scans\n`);

  const width = Math.max(...fixtures.map((f) => f.label.length));
  console.log(`${"".padEnd(width)}  ${SCORED_CONCERNS.map((c) => c.slice(0, 8).padStart(9)).join("")}`);
  for (const f of fixtures) {
    const row = SCORED_CONCERNS.map((c) => {
      const s = f.summary.concerns[c];
      return (s ? s.raw.toFixed(1) : "-").padStart(9);
    }).join("");
    console.log(`${f.label.padEnd(width)}  ${row}`);
  }

  console.log(`\n${"concern".padEnd(10)} ${"min".padStart(7)} ${"max".padStart(7)} ${"median".padStart(7)}  healthy>=  would call healthy`);
  for (const c of SCORED_CONCERNS) {
    const vals = fixtures
      .map((f) => f.summary.concerns[c]?.raw)
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b);
    if (vals.length === 0) continue;
    const median = vals[Math.floor(vals.length / 2)];
    const healthy = t.healthyByConcern[c];
    const n = vals.filter((v) => v >= healthy).length;
    console.log(
      `${c.padEnd(10)} ${vals[0].toFixed(1).padStart(7)} ${vals.at(-1)!.toFixed(1).padStart(7)} ` +
        `${median.toFixed(1).padStart(7)}  ${String(healthy).padStart(9)}  ${n} of ${vals.length}`,
    );
  }

  console.log("\nthreshold firing counts across the bank:");
  const acne = t.values.ACNE_ASK_T;
  const redness = t.values.REDNESS_T;
  const wrinkle = t.values.WRINKLE_HEALTHY_T;
  const below = (c: string, th: number) =>
    fixtures.filter((f) => (f.summary.concerns[c as "acne"]?.raw ?? 999) < th);
  const atOrAbove = (c: string, th: number) =>
    fixtures.filter((f) => (f.summary.concerns[c as "acne"]?.raw ?? -1) >= th);
  console.log(`  ACNE_ASK_T        ${acne}: asks on ${below("acne", acne).map((f) => f.label).join(", ") || "nobody"}`);
  console.log(`  REDNESS_T         ${redness}: reactive for ${below("redness", redness).map((f) => f.label).join(", ") || "nobody"}`);
  console.log(`  WRINKLE_HEALTHY_T ${wrinkle}: anti-aging unnecessary for ${atOrAbove("wrinkle", wrinkle).length} of ${fixtures.length}`);

  console.log("\nskin_type labels returned by the API:");
  const labelsSeen = new Map<string, string[]>();
  for (const f of fixtures) {
    for (const [region, label] of Object.entries(f.summary.skinType)) {
      if (!label) continue;
      labelsSeen.set(label, [...(labelsSeen.get(label) ?? []), `${f.label}:${region}`]);
    }
  }
  for (const [label, where] of [...labelsSeen].sort()) {
    console.log(`  ${JSON.stringify(label).padEnd(26)} ${where.length} region(s)`);
  }

  console.log("\nskin_age, which no rule reads:");
  for (const f of fixtures) console.log(`  ${f.label.padEnd(width)}  ${f.summary.skinAge}`);
}

main();
