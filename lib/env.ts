const DEFAULTS = {
  DEMO_MODE: "replay",
  UNIT_BUDGET_TOTAL: "1000",
  UNIT_HARD_STOP: "900",
  LIVE_SCAN_DAILY_CAP: "10",
  HIGH_ACID_PCT: "20",
} as const;

function num(name: keyof typeof DEFAULTS): number {
  const parsed = Number(process.env[name] ?? DEFAULTS[name]);
  if (!Number.isFinite(parsed)) throw new Error(`Env var ${name} is not a number`);
  return parsed;
}

/** Reads a secret. The value is never included in thrown messages or logs. */
export function secret(name: "YOUCAM_API_KEY" | "ANTHROPIC_API_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local.`);
  return value;
}

export function hasSecret(name: "YOUCAM_API_KEY" | "ANTHROPIC_API_KEY"): boolean {
  return Boolean(process.env[name]);
}

export const config = {
  get demoMode(): "replay" | "live" {
    return process.env.DEMO_MODE === "live" ? "live" : "replay";
  },
  get unitBudgetTotal() {
    return num("UNIT_BUDGET_TOTAL");
  },
  get unitHardStop() {
    return num("UNIT_HARD_STOP");
  },
  get liveScanDailyCap() {
    return num("LIVE_SCAN_DAILY_CAP");
  },
  get highAcidPct() {
    return num("HIGH_ACID_PCT");
  },
};
