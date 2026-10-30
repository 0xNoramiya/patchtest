import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeForScan } from "./image";
import { imageHash, SCAN_UNIT_COST } from "./ledger";
import * as client from "./youcam/client";
import { parseSkinAnalysis } from "./youcam/parse";
import { SD_CONCERNS } from "./youcam/types";

export type ScanFixture = {
  label: string;
  recorded_at: string;
  source: string;
  image: { file: string; width: number; height: number; hash: string };
  units_spent: number;
  requests: Record<string, { endpoint: string; body: Record<string, unknown> }>;
  skin_analysis: unknown;
  fitzpatrick: unknown;
  summary: ReturnType<typeof parseSkinAnalysis>;
  local_masks: Record<string, string[]>;
};

/**
 * Mask URLs are pre-signed with a two hour expiry and carry an AWS access key id
 * in the query string. Committed fixtures keep the path and drop the signature.
 */
function stringifyWithoutSignatures(value: unknown): string {
  const stripped = JSON.stringify(value, (_key, v) =>
    typeof v === "string" && v.startsWith("http") && v.includes("?")
      ? `${v.split("?")[0]}?<signature stripped, expired after 2h>`
      : v,
  );
  return `${JSON.stringify(JSON.parse(stripped), null, 2)}\n`;
}

export function fixtureDir(label: string): string {
  return path.join(process.cwd(), "fixtures", "scans", label);
}

/** Returns the stored fixture when this exact image was already scanned. */
export async function cachedScan(label: string, hash: string): Promise<ScanFixture | null> {
  try {
    const existing = JSON.parse(
      await readFile(path.join(fixtureDir(label), "fixture.json"), "utf8"),
    ) as ScanFixture;
    return existing.image?.hash === hash ? existing : null;
  } catch {
    return null;
  }
}

export type RunScanOptions = {
  imagePath: string;
  label: string;
  onProgress?: (step: string) => void;
};

/**
 * One full scan: normalize, upload once, run both APIs against the same file,
 * download the masks before the signatures expire, write the fixture.
 * Costs SCAN_UNIT_COST units, or nothing if the image was scanned before.
 */
export async function runScan(opts: RunScanOptions): Promise<{ fixture: ScanFixture; cached: boolean }> {
  const { imagePath, label } = opts;
  const log = opts.onProgress ?? (() => {});
  const scanId = `${label}-${Date.now()}`;

  const image = await normalizeForScan(await readFile(imagePath));
  const hash = imageHash(image.bytes, SD_CONCERNS);

  const cached = await cachedScan(label, hash);
  if (cached) {
    log("cached, no units spent");
    if (!cached.summary) {
      // Fixtures recorded before the parser existed get a summary without paying again.
      cached.summary = parseSkinAnalysis(
        cached.skin_analysis as Parameters<typeof parseSkinAnalysis>[0],
        (cached.fitzpatrick as { results?: { fitzpatrick_scale?: string } })?.results
          ?.fitzpatrick_scale as Parameters<typeof parseSkinAnalysis>[1],
      );
      await writeFile(path.join(fixtureDir(label), "fixture.json"), stringifyWithoutSignatures(cached));
    }
    return { fixture: cached, cached: true };
  }

  const outDir = fixtureDir(label);
  const maskDir = path.join(outDir, "masks");
  await mkdir(maskDir, { recursive: true });
  await writeFile(path.join(outDir, "input.jpg"), image.bytes);

  log("uploading");
  const fileId = await client.uploadImage(image.bytes, { fileName: `${label}.jpg` });

  log("skin analysis");
  const skinTaskId = await client.createSkinAnalysis(fileId, { scanId, imageHash: hash });
  const skin = await client.pollSkinAnalysis(skinTaskId, { scanId, imageHash: hash });

  log("fitzpatrick");
  const fitzTaskId = await client.createFitzpatrick(fileId, { scanId, imageHash: hash });
  const fitz = await client.pollFitzpatrick(fitzTaskId, { scanId, imageHash: hash });

  log("downloading masks");
  const localMasks: Record<string, string[]> = {};
  for (const item of skin.results?.output ?? []) {
    const saved: string[] = [];
    for (const [i, url] of (item.mask_urls ?? []).entries()) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const suffix = item.region && item.region !== "whole" ? `_${item.region}` : "";
      const name = `${item.type}${suffix}${i > 0 ? `_${i}` : ""}.png`;
      await writeFile(path.join(maskDir, name), Buffer.from(await res.arrayBuffer()));
      saved.push(`masks/${name}`);
    }
    localMasks[`${item.type}:${item.region ?? "whole"}`] = saved;
  }

  const fixture: ScanFixture = {
    label,
    recorded_at: new Date().toISOString(),
    source: "live YouCam API call",
    image: { file: "input.jpg", width: image.width, height: image.height, hash },
    units_spent: SCAN_UNIT_COST,
    requests: {
      skin_analysis: {
        endpoint: "POST /s2s/v2.0/task/skin-analysis",
        body: { src_file_id: "<file id, not stored>", dst_actions: [...SD_CONCERNS], format: "json" },
      },
      fitzpatrick: {
        endpoint: "POST /s2s/v2.0/task/fitzpatrick-scale-analyzer",
        body: { src_file_id: "<file id, not stored>", version: "1.0", index: 0 },
      },
    },
    skin_analysis: skin,
    fitzpatrick: fitz,
    summary: parseSkinAnalysis(skin, fitz.results?.fitzpatrick_scale ?? null),
    local_masks: localMasks,
  };

  await writeFile(path.join(outDir, "fixture.json"), stringifyWithoutSignatures(fixture));
  return { fixture, cached: false };
}
