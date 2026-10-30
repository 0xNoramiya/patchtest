import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./env";

export type LedgerStatus = "success" | "error" | "refused" | "cached";

export type LedgerEntry = {
  ts: string;
  scan_id: string;
  endpoint: string;
  units: number;
  status: LedgerStatus;
  /** SHA-256 of the normalized image bytes plus action list. The image itself is never stored here. */
  image_hash: string | null;
  task_id: string | null;
  note?: string;
};

const LEDGER_PATH = path.join(process.cwd(), "data", "ledger.json");

/** Units are charged by YouCam only when a task reaches `success`. */
export const UNIT_COST = {
  /** SD tier, 5 to 8 concerns. */
  skin_analysis_sd: 12,
  fitzpatrick: 10,
  /** The File API itself is free. */
  file: 0,
} as const;

export const SCAN_UNIT_COST = UNIT_COST.skin_analysis_sd + UNIT_COST.fitzpatrick;

export function imageHash(bytes: Buffer | Uint8Array, actions: readonly string[] = []): string {
  return createHash("sha256")
    .update(bytes)
    .update("\u0000")
    .update([...actions].sort().join(","))
    .digest("hex");
}

export async function readLedger(): Promise<LedgerEntry[]> {
  try {
    return JSON.parse(await readFile(LEDGER_PATH, "utf8")) as LedgerEntry[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function append(entry: Omit<LedgerEntry, "ts">): Promise<LedgerEntry> {
  const full: LedgerEntry = { ts: new Date().toISOString(), ...entry };
  const entries = await readLedger();
  entries.push(full);
  await mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await writeFile(LEDGER_PATH, `${JSON.stringify(entries, null, 2)}\n`);
  return full;
}

export function spent(entries: LedgerEntry[]): number {
  return entries.reduce((total, e) => total + (e.status === "success" ? e.units : 0), 0);
}

/** Distinct scans started on a given UTC day, successful or not. */
export function scansOn(entries: LedgerEntry[], day = new Date().toISOString().slice(0, 10)): number {
  const ids = new Set(
    entries.filter((e) => e.ts.startsWith(day) && e.status !== "refused").map((e) => e.scan_id),
  );
  return ids.size;
}

export type BudgetState = {
  spent: number;
  remaining: number;
  scansToday: number;
  liveAllowed: boolean;
  reason?: string;
};

/**
 * The circuit breaker. Callers must check `liveAllowed` before any billable
 * request and fall back to replay mode when it is false.
 */
export async function budget(pendingUnits = 0): Promise<BudgetState> {
  const entries = await readLedger();
  const used = spent(entries);
  const scansToday = scansOn(entries);
  const state: BudgetState = {
    spent: used,
    remaining: config.unitBudgetTotal - used,
    scansToday,
    liveAllowed: true,
  };

  if (used + pendingUnits > config.unitHardStop) {
    state.liveAllowed = false;
    state.reason = `Unit hard stop reached (${used}/${config.unitHardStop} spent). Serving a replayed scan instead.`;
  } else if (scansToday >= config.liveScanDailyCap) {
    state.liveAllowed = false;
    state.reason = `Daily live scan cap reached (${scansToday}/${config.liveScanDailyCap}). Serving a replayed scan instead.`;
  }
  return state;
}

export class BudgetExceeded extends Error {
  constructor(readonly state: BudgetState) {
    super(state.reason ?? "Unit budget exceeded");
    this.name = "BudgetExceeded";
  }
}
