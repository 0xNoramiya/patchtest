import { NextResponse } from "next/server";
import { config } from "@/lib/env";
import { budget, SCAN_UNIT_COST } from "@/lib/ledger";

/** Lets the UI say plainly whether a live scan is possible, and why not. */
export async function GET() {
  const state = await budget(SCAN_UNIT_COST);
  return NextResponse.json({
    demoMode: config.demoMode,
    liveAvailable: config.demoMode === "live" && state.liveAllowed,
    reason:
      config.demoMode !== "live"
        ? "Live scanning is switched off here. Every preset replays a scan that really was run through both APIs."
        : state.reason,
    spent: state.spent,
    budgetTotal: config.unitBudgetTotal,
    hardStop: config.unitHardStop,
    scansToday: state.scansToday,
    dailyCap: config.liveScanDailyCap,
    unitsPerScan: SCAN_UNIT_COST,
  });
}
