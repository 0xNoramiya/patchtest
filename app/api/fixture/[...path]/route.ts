import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ROOT = path.join(process.cwd(), "fixtures");
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".json": "application/json",
};

/** Serves recorded scan images and masks. Confined to the fixtures directory. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const target = path.resolve(ROOT, ...segments);
  if (!target.startsWith(`${ROOT}${path.sep}`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const type = TYPES[path.extname(target).toLowerCase()];
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const bytes = await readFile(target);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
