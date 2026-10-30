import { NextResponse } from "next/server";
import { config } from "@/lib/env";
import { normalizeForScan } from "@/lib/image";
import { budget, imageHash, SCAN_UNIT_COST } from "@/lib/ledger";
import { createFitzpatrick, createSkinAnalysis, uploadImage, YouCamError } from "@/lib/youcam/client";
import { SD_CONCERNS, shopperMessageFor } from "@/lib/youcam/types";

export const maxDuration = 60;

/**
 * Creates both tasks and returns their ids. It never waits for them: the client
 * polls the status route instead, so no request is held open for the tens of
 * seconds a task can take.
 */
export async function POST(request: Request) {
  if (config.demoMode !== "live") {
    return NextResponse.json(
      { error: "Live scanning is switched off here. Every preset is a recorded real scan." },
      { status: 503 },
    );
  }

  const state = await budget(SCAN_UNIT_COST);
  if (!state.liveAllowed) {
    return NextResponse.json({ error: state.reason, budget: state }, { status: 429 });
  }

  let bytes: Buffer;
  try {
    const body = (await request.json()) as { image?: string };
    const base64 = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
    if (!base64) throw new Error("no image");
    bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 12 * 1024 * 1024) throw new Error("too large");
  } catch {
    return NextResponse.json({ error: "Send a base64 image under 12 MB." }, { status: 400 });
  }

  try {
    const image = await normalizeForScan(bytes);
    const hash = imageHash(image.bytes, SD_CONCERNS);
    const scanId = `live-${Date.now()}`;

    const fileId = await uploadImage(image.bytes, { fileName: `${scanId}.jpg` });
    const skinTaskId = await createSkinAnalysis(fileId, { scanId, imageHash: hash });
    const fitzTaskId = await createFitzpatrick(fileId, { scanId, imageHash: hash });

    return NextResponse.json({
      scanId,
      hash,
      skinTaskId,
      fitzTaskId,
      unitsIfSuccessful: SCAN_UNIT_COST,
      image: { width: image.width, height: image.height },
    });
  } catch (err) {
    if (err instanceof YouCamError) {
      return NextResponse.json({ error: shopperMessageFor(err.code), code: err.code }, { status: 422 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "That scan could not be started." },
      { status: 500 },
    );
  }
}
