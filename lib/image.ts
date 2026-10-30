import sharp from "sharp";

const MIN_SHORT_SIDE = 480;
const MAX_LONG_SIDE = 2560;
const MAX_BYTES = 9.5 * 1024 * 1024;

export type NormalizedImage = {
  bytes: Buffer;
  width: number;
  height: number;
  contentType: "image/jpeg";
};

/**
 * Produces one JPEG that satisfies both APIs at once: Skin Analysis SD needs a
 * short side of at least 480 px, Fitzpatrick needs JPEG and at least 320 px.
 * EXIF is dropped, which also strips any location tag from a phone photo.
 */
export async function normalizeForScan(input: Buffer): Promise<NormalizedImage> {
  const base = sharp(input, { failOn: "error" }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Could not read image dimensions");

  const shortSide = Math.min(meta.width, meta.height);
  const longSide = Math.max(meta.width, meta.height);
  let scale = 1;
  if (longSide > MAX_LONG_SIDE) scale = MAX_LONG_SIDE / longSide;
  if (shortSide * scale < MIN_SHORT_SIDE) scale = MIN_SHORT_SIDE / shortSide;

  const pipeline =
    scale === 1
      ? base
      : base.resize({
          width: Math.round(meta.width * scale),
          height: Math.round(meta.height * scale),
          fit: "fill",
        });

  for (const quality of [92, 85, 75, 65]) {
    const bytes = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (bytes.byteLength <= MAX_BYTES) {
      const out = await sharp(bytes).metadata();
      return { bytes, width: out.width ?? 0, height: out.height ?? 0, contentType: "image/jpeg" };
    }
  }
  throw new Error("Image is too large to normalize under 10 MB");
}

/** Face width as a share of image width. The SD tier needs more than 0.6. */
export function faceWidthRatio(faceWidthPx: number, imageWidthPx: number): number {
  return imageWidthPx > 0 ? faceWidthPx / imageWidthPx : 0;
}
