import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { ScanSummary } from "@/lib/youcam/parse";

export type ScanListing = {
  label: string;
  imagePath: string;
  fitzpatrick: string | null;
  skinType: string | null;
  headline: { concern: string; raw: number } | null;
};

/** The recorded scan bank, for choosing a face without spending units. */
export async function GET() {
  const dir = path.join(process.cwd(), "fixtures", "scans");
  const entries = await readdir(dir, { withFileTypes: true });

  const listings: ScanListing[] = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      const raw = JSON.parse(
        await readFile(path.join(dir, entry.name, "fixture.json"), "utf8"),
      ) as { summary?: ScanSummary };
      if (!raw.summary) continue;

      const scores = Object.entries(raw.summary.concerns);
      const lowest = scores.reduce<{ concern: string; raw: number } | null>(
        (worst, [concern, score]) =>
          !worst || score.raw < worst.raw ? { concern, raw: score.raw } : worst,
        null,
      );

      listings.push({
        label: entry.name,
        imagePath: `/api/fixture/scans/${entry.name}/input.jpg`,
        fitzpatrick: raw.summary.fitzpatrick,
        skinType: raw.summary.skinType.whole ?? null,
        headline: lowest,
      });
    } catch {
      // A folder without a readable fixture is skipped rather than failing the list.
    }
  }

  return NextResponse.json({ scans: listings });
}
