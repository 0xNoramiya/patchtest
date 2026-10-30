import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { budget } from "@/lib/ledger";
import { liveFixtureDir } from "@/lib/scan-runner";
import { checkFitzpatrick, checkSkinAnalysis, YouCamError } from "@/lib/youcam/client";
import { parseSkinAnalysis } from "@/lib/youcam/parse";
import { shopperMessageFor } from "@/lib/youcam/types";

export const maxDuration = 60;

/**
 * One poll of both tasks. Cheap enough for the browser to call every couple of
 * seconds. When both have succeeded it writes the fixture so the result can be
 * replayed without paying again.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scanId = url.searchParams.get("scanId");
  const hash = url.searchParams.get("hash");
  const skinTaskId = url.searchParams.get("skinTaskId");
  const fitzTaskId = url.searchParams.get("fitzTaskId");

  if (!scanId || !hash || !skinTaskId || !fitzTaskId) {
    return NextResponse.json({ error: "Missing task parameters" }, { status: 400 });
  }
  const opts = { scanId, imageHash: hash };

  try {
    const [skin, fitz] = await Promise.all([
      checkSkinAnalysis(skinTaskId, opts),
      checkFitzpatrick(fitzTaskId, opts),
    ]);

    if (skin.task_status !== "success" || fitz.task_status !== "success") {
      return NextResponse.json({ status: "running" });
    }

    const summary = parseSkinAnalysis(skin, fitz.results?.fitzpatrick_scale ?? null);

    // Mask urls are signed for two hours, so the fixture keeps the scores and
    // points at the live urls while they last.
    const dir = liveFixtureDir(scanId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "fixture.json"),
      `${JSON.stringify(
        {
          label: scanId,
          recorded_at: new Date().toISOString(),
          source: "live YouCam API call",
          image: { file: "input.jpg", hash },
          summary,
          skin_analysis: skin,
          fitzpatrick: fitz,
        },
        null,
        2,
      )}\n`,
    );

    return NextResponse.json({ status: "success", scanLabel: scanId, budget: await budget() });
  } catch (err) {
    if (err instanceof YouCamError) {
      return NextResponse.json(
        { status: "error", error: shopperMessageFor(err.code), code: err.code },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : "That scan failed." },
      { status: 500 },
    );
  }
}
