/**
 * Fits the generated cover to the gallery: exact 3:2, the same 1800x1200 the
 * five screenshots use.
 *
 *   node scripts/gallery-cover.mjs <source.png> [outPath]
 *
 * The generator returns 1024x688, which is 1.488 rather than 1.5, so this takes
 * the largest exact-3:2 rectangle out of the middle and resizes. Nothing is
 * painted on and nothing is stretched: an image that has to be squashed to meet
 * a ratio is the wrong image.
 *
 * Deliberately a plain Lanczos resize and not a model upscale. The 2K upscale of
 * this cover came back with scrawled lettering hallucinated into the blank paper
 * at the bottom - faint, but it read as handwriting, and invented text on a
 * submission cover is worse than a slightly softer one.
 */
import sharp from "sharp";
import path from "node:path";

const src = process.argv[2];
const out = path.resolve(process.argv[3] ?? "docs/gallery/thumbnail.png");
if (!src) {
  console.error("usage: node scripts/gallery-cover.mjs <source.png> [outPath]");
  process.exit(1);
}

const TARGET = { width: 1800, height: 1200 };

const image = sharp(src);
const { width, height } = await image.metadata();
const ratio = TARGET.width / TARGET.height;

// The biggest 3:2 box that fits, centred.
const cropWidth = Math.min(width, Math.round(height * ratio));
const cropHeight = Math.min(height, Math.round(width / ratio));

await image
  .extract({
    left: Math.round((width - cropWidth) / 2),
    top: Math.round((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  })
  .resize(TARGET.width, TARGET.height, { fit: "fill", kernel: "lanczos3" })
  .png({ compressionLevel: 9 })
  .toFile(out);

const after = await sharp(out).metadata();
console.log(
  `${width}x${height} -> crop ${cropWidth}x${cropHeight} -> ${after.width}x${after.height}` +
    `  (${(after.width / after.height).toFixed(4)})  ${out}`,
);
