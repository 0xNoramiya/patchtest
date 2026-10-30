import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProposedCart } from "./types";

const DIR = path.join(process.cwd(), "fixtures", "agent");

/**
 * Keyed on everything that could change the answer, so a recorded reply is only
 * reused for an identical request.
 */
export function promptKey(system: string, user: string, model: string): string {
  return createHash("sha256").update(model).update("\u0000").update(system).update("\u0000").update(user).digest("hex").slice(0, 32);
}

export async function readRecorded(key: string): Promise<ProposedCart | null> {
  try {
    const raw = await readFile(path.join(DIR, `${key}.json`), "utf8");
    return (JSON.parse(raw) as { response: ProposedCart }).response;
  } catch {
    return null;
  }
}

export async function record(
  key: string,
  meta: { model: string; label?: string; run?: number },
  response: ProposedCart,
): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(
    path.join(DIR, `${key}.json`),
    `${JSON.stringify({ key, recorded_at: new Date().toISOString(), ...meta, response }, null, 2)}\n`,
  );
}
