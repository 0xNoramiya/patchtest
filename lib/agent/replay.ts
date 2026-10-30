import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "../ledger";
import type { ProposedCart } from "./types";

/**
 * Recorded responses ship with the repo so every demo preset works with no LLM
 * key at all. Anything recorded at runtime goes to the writable data directory,
 * because the image itself is read only once deployed.
 */
const BUNDLED = path.join(process.cwd(), "fixtures", "agent");
const WRITABLE = path.join(DATA_DIR, "agent");

/**
 * Keyed on everything that could change the answer, so a recorded reply is only
 * reused for an identical request.
 */
export function promptKey(system: string, user: string, model: string): string {
  return createHash("sha256")
    .update(model)
    .update("\u0000")
    .update(system)
    .update("\u0000")
    .update(user)
    .digest("hex")
    .slice(0, 32);
}

export async function readRecorded(key: string): Promise<ProposedCart | null> {
  for (const dir of [BUNDLED, WRITABLE]) {
    try {
      const raw = await readFile(path.join(dir, `${key}.json`), "utf8");
      return (JSON.parse(raw) as { response: ProposedCart }).response;
    } catch {
      // Try the next location.
    }
  }
  return null;
}

/** Best effort. A read-only filesystem must not break a response. */
export async function record(
  key: string,
  meta: { model: string; label?: string; run?: number },
  response: ProposedCart,
): Promise<void> {
  const dir = process.env.DATA_DIR ? WRITABLE : BUNDLED;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${key}.json`),
      `${JSON.stringify({ key, recorded_at: new Date().toISOString(), ...meta, response }, null, 2)}\n`,
    );
  } catch {
    // Nothing to do. The answer is still returned, it just will not be reused.
  }
}
