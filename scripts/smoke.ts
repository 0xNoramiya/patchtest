/**
 * M0 smoke test. Spends real units: 12 for Skin Analysis SD (8 concerns) plus
 * 10 for Fitzpatrick, so 22 per image. Run only with explicit approval.
 *
 *   pnpm smoke <image-path> [--label name]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeForScan } from "../lib/image";
import { imageHash, readLedger, SCAN_UNIT_COST, spent } from "../lib/ledger";
import * as client from "../lib/youcam/client";
import { SD_CONCERNS } from "../lib/youcam/types";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));

/**
 * Mask URLs are pre-signed and the signature expires after two hours, so the
 * query string is worthless in a committed fixture. It also carries an AWS access
 * key id, which the secrets scan rightly objects to. The bytes are saved locally.
 */
function stringifyWithoutSignatures(value: unknown): string {
  const stripped = JSON.stringify(value, (_key, v) =>
    typeof v === "string" && v.startsWith("http") && v.includes("?")
      ? `${v.split("?")[0]}?<signature stripped, expired after 2h>`
      : v,
  );
  return `${JSON.stringify(JSON.parse(stripped), null, 2)}\n`;
}

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Usage: pnpm smoke <image-path> [--label name]");
    process.exit(1);
  }
  const labelFlag = process.argv.indexOf("--label");
  const label =
    labelFlag > -1 ? process.argv[labelFlag + 1] : path.basename(imagePath).replace(/\.[^.]+$/, "");
  const scanId = `smoke-${label}-${Date.now()}`;

  const raw: Array<{ path: string; httpStatus: number; body: unknown }> = [];
  client.setCaptureSink((event) => raw.push(event));

  const before = spent(await readLedger());
  console.log(`Units spent before this run: ${before}`);
  console.log(`This run costs ${SCAN_UNIT_COST} units if both tasks succeed, 0 if they fail.\n`);

  const image = await normalizeForScan(await readFile(imagePath));
  const hash = imageHash(image.bytes, SD_CONCERNS);
  console.log(
    `Normalized: ${image.width}x${image.height} JPEG, ${(image.bytes.byteLength / 1024).toFixed(0)} KB`,
  );
  console.log(`Image hash: ${hash.slice(0, 16)}...\n`);

  const outDir = path.join(process.cwd(), "fixtures", "scans", label);
  const maskDir = path.join(outDir, "masks");
  await mkdir(maskDir, { recursive: true });
  await writeFile(path.join(outDir, "input.jpg"), image.bytes);

  console.log("1/4 uploading (free)");
  const fileId = await client.uploadImage(image.bytes, { fileName: `${label}.jpg` });
  console.log(`     file_id: ${fileId}\n`);

  console.log(`2/4 skin-analysis, actions: ${SD_CONCERNS.join(", ")}`);
  const skinTaskId = await client.createSkinAnalysis(fileId, { scanId, imageHash: hash });
  console.log(`     task_id: ${skinTaskId}`);
  const skin = await client.pollSkinAnalysis(skinTaskId, { scanId, imageHash: hash });
  console.log(`     ${skin.results?.output?.length ?? 0} output items\n`);

  console.log("3/4 fitzpatrick-scale-analyzer");
  const fitzTaskId = await client.createFitzpatrick(fileId, { scanId, imageHash: hash });
  console.log(`     task_id: ${fitzTaskId}`);
  const fitz = await client.pollFitzpatrick(fitzTaskId, { scanId, imageHash: hash });
  console.log(`     fitzpatrick_scale: ${fitz.results?.fitzpatrick_scale}\n`);

  console.log("4/4 downloading masks (YouCam expires them after about 24h)");
  const masks: Record<string, string[]> = {};
  for (const item of skin.results?.output ?? []) {
    const saved: string[] = [];
    for (const [i, url] of (item.mask_urls ?? []).entries()) {
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`     ${item.type}: mask fetch failed with HTTP ${res.status}`);
        continue;
      }
      const suffix = item.region && item.region !== "whole" ? `_${item.region}` : "";
      const name = `${item.type}${suffix}${i > 0 ? `_${i}` : ""}.png`;
      await writeFile(path.join(maskDir, name), Buffer.from(await res.arrayBuffer()));
      saved.push(`masks/${name}`);
    }
    masks[`${item.type}:${item.region ?? "whole"}`] = saved;
  }
  console.log(`     saved ${Object.values(masks).flat().length} mask files\n`);

  const fixture = {
    label,
    recorded_at: new Date().toISOString(),
    source: "live YouCam API call",
    image: { file: "input.jpg", width: image.width, height: image.height, hash },
    units_spent: SCAN_UNIT_COST,
    requests: {
      skin_analysis: {
        endpoint: "POST /s2s/v2.0/task/skin-analysis",
        body: { src_file_id: "<file id, not stored>", dst_actions: SD_CONCERNS, format: "json" },
      },
      fitzpatrick: {
        endpoint: "POST /s2s/v2.0/task/fitzpatrick-scale-analyzer",
        body: { src_file_id: "<file id, not stored>", version: "1.0", index: 0 },
      },
    },
    skin_analysis: skin,
    fitzpatrick: fitz,
    local_masks: masks,
  };
  await writeFile(path.join(outDir, "fixture.json"), stringifyWithoutSignatures(fixture));
  await writeFile(path.join(outDir, "raw-responses.json"), stringifyWithoutSignatures(raw));

  console.log("=== OBSERVED SCHEMA ===");
  for (const item of skin.results?.output ?? []) {
    console.log(
      `  ${String(item.type).padEnd(12)} region=${String(item.region ?? "-").padEnd(8)}` +
        ` raw=${String(item.raw_score).padEnd(8)} ui=${String(item.ui_score).padEnd(5)}` +
        ` masks=${item.mask_urls?.length ?? 0}  keys: [${Object.keys(item).join(", ")}]`,
    );
  }
  console.log(`\nskin-analysis data keys: [${Object.keys(skin).join(", ")}]`);
  console.log(`fitzpatrick data keys:   [${Object.keys(fitz).join(", ")}]`);
  console.log(`fitzpatrick results:     ${JSON.stringify(fitz.results)}`);

  const after = spent(await readLedger());
  console.log(`\nUnits spent after this run: ${after} (delta ${after - before})`);
  console.log(`Fixture written to fixtures/scans/${label}/`);
}

main().catch((err) => {
  console.error(`\nSMOKE TEST FAILED: ${err instanceof Error ? err.message : String(err)}`);
  if (err && typeof err === "object" && "code" in err) {
    console.error(`error_code: ${(err as { code: unknown }).code}`);
  }
  process.exitCode = 1;
});
