import { describe, expect, it } from "vitest";
import { scansOn, spent, type LedgerEntry } from "./ledger";

const at = (ts: string, scan_id: string, status: LedgerEntry["status"], units = 12): LedgerEntry => ({
  ts,
  scan_id,
  endpoint: "task/skin-analysis",
  units,
  status,
  image_hash: "x",
  task_id: "t",
});

describe("the daily cap counts what it is meant to protect", () => {
  const day = "2026-11-05";

  it("counts a successful scan once, not once per task", () => {
    const entries = [
      at(`${day}T01:00:00Z`, "scan-a", "success", 12),
      at(`${day}T01:00:05Z`, "scan-a", "success", 10),
    ];
    expect(scansOn(entries, day)).toBe(1);
  });

  it("does not count a scan the API rejected, because it was free", () => {
    const entries = [
      at(`${day}T01:00:00Z`, "scan-a", "success"),
      at(`${day}T02:00:00Z`, "scan-bad", "error", 0),
      at(`${day}T03:00:00Z`, "scan-worse", "error", 0),
    ];
    expect(scansOn(entries, day)).toBe(1);
    expect(spent(entries)).toBe(12);
  });

  it("does not count one the breaker already refused", () => {
    expect(scansOn([at(`${day}T01:00:00Z`, "scan-a", "refused", 0)], day)).toBe(0);
  });

  it("ignores other days", () => {
    const entries = [at("2026-11-04T23:59:00Z", "scan-a", "success")];
    expect(scansOn(entries, day)).toBe(0);
  });

  it("a run of failures cannot close the live path", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      at(`${day}T0${i % 9}:00:00Z`, `scan-fail-${i}`, "error", 0),
    );
    expect(scansOn(entries, day)).toBe(0);
    expect(spent(entries)).toBe(0);
  });
});
