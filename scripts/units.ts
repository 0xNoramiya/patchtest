import { config } from "../lib/env";
import { readLedger, scansOn, spent } from "../lib/ledger";

async function main() {
  const entries = await readLedger();
  const used = spent(entries);

  const byEndpoint = new Map<string, { units: number; calls: number }>();
  for (const e of entries) {
    const row = byEndpoint.get(e.endpoint) ?? { units: 0, calls: 0 };
    row.calls += 1;
    if (e.status === "success") row.units += e.units;
    byEndpoint.set(e.endpoint, row);
  }

  console.log(`YouCam units spent: ${used} of ${config.unitBudgetTotal}`);
  console.log(`Hard stop: ${config.unitHardStop}   Remaining to hard stop: ${config.unitHardStop - used}`);
  console.log(`Scans today: ${scansOn(entries)} of ${config.liveScanDailyCap}`);
  console.log("");

  for (const [endpoint, row] of byEndpoint) {
    console.log(`  ${endpoint.padEnd(34)} ${String(row.units).padStart(4)} units  (${row.calls} calls)`);
  }

  const failed = entries.filter((e) => e.status === "error").length;
  const refused = entries.filter((e) => e.status === "refused").length;
  console.log("");
  console.log(`  ${entries.length} ledger entries, ${failed} failed (free), ${refused} refused by the breaker`);
}

main();
