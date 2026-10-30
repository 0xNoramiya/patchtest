import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/** Bundled fixtures, plus anything a live scan wrote to the data volume. */
const ROOTS = [
  path.join(process.cwd(), "fixtures"),
  path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data")),
];

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".json": "application/json",
};

/** Serves recorded scan images and masks. Confined to those two directories. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const type = TYPES[path.extname(segments.at(-1) ?? "").toLowerCase()];
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (const root of ROOTS) {
    const target = path.resolve(root, ...segments);
    if (!target.startsWith(`${root}${path.sep}`)) continue;
    try {
      const bytes = await readFile(target);
      return new NextResponse(new Uint8Array(bytes), {
        headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
      });
    } catch {
      // Try the next root.
    }
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
