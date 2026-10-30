"use client";

import { useCallback, useRef, useState } from "react";

export type BudgetState = {
  liveAvailable: boolean;
  reason?: string;
  spent: number;
  budgetTotal: number;
  scansToday: number;
  dailyCap: number;
  unitsPerScan: number;
};

type Check = { ok: boolean; message: string };

/**
 * A cheap quality check in the browser before anything is sent. YouCam does not
 * charge for a task that fails validation, so this is about not wasting the
 * shopper's time rather than about saving units. The API's own face checks are
 * authoritative and their error codes are shown if they fire.
 */
async function inspect(file: File): Promise<{ checks: Check[]; dataUrl: string | null }> {
  const bitmap = await createImageBitmap(file);
  const checks: Check[] = [];

  const shortSide = Math.min(bitmap.width, bitmap.height);
  checks.push({
    ok: shortSide >= 480,
    message:
      shortSide >= 480
        ? `Resolution is fine, ${bitmap.width} by ${bitmap.height}.`
        : `Too small. The short side is ${shortSide} pixels and needs at least 480.`,
  });

  // Downscale for both the brightness sample and the upload.
  const maxLong = 2560;
  const scale = Math.min(1, maxLong / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { checks, dataUrl: null };
  ctx.drawImage(bitmap, 0, 0, w, h);

  // Mean luminance over the centre, where a face would be.
  const box = ctx.getImageData(Math.round(w * 0.25), Math.round(h * 0.2), Math.round(w * 0.5), Math.round(h * 0.6));
  let total = 0;
  for (let i = 0; i < box.data.length; i += 4) {
    total += 0.2126 * box.data[i] + 0.7152 * box.data[i + 1] + 0.0722 * box.data[i + 2];
  }
  const mean = total / (box.data.length / 4);
  checks.push({
    ok: mean >= 55 && mean <= 230,
    message:
      mean < 55
        ? "Too dark. Find brighter, even light facing you."
        : mean > 230
          ? "Very bright, parts of the face may be blown out."
          : "Lighting looks usable.",
  });

  const ratio = bitmap.width / bitmap.height;
  checks.push({
    ok: ratio > 0.5 && ratio < 1.6,
    message:
      ratio > 0.5 && ratio < 1.6
        ? "Framing looks usable."
        : "Unusual crop. A head and shoulders portrait works best.",
  });

  return { checks, dataUrl: canvas.toDataURL("image/jpeg", 0.92) };
}

export function LiveScan({
  budget,
  onScanned,
  onCancel,
}: {
  budget: BudgetState;
  onScanned: (scanLabel: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [status, setStatus] = useState<"idle" | "scanning" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const onFile = useCallback(async (file: File) => {
    setStatus("idle");
    setMessage(null);
    const { checks: result, dataUrl } = await inspect(file);
    setChecks(result);
    setPreview(dataUrl);
  }, []);

  const start = useCallback(async () => {
    if (!preview) return;
    setStatus("scanning");
    setMessage("Uploading and creating both tasks");
    try {
      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview }),
      });
      const started = await res.json();
      if (!res.ok) throw new Error(started.error ?? "Could not start the scan");

      const params = new URLSearchParams({
        scanId: started.scanId,
        hash: started.hash,
        skinTaskId: started.skinTaskId,
        fitzTaskId: started.fitzTaskId,
      });

      const deadline = Date.now() + 150_000;
      for (;;) {
        await new Promise((r) => setTimeout(r, 2500));
        setMessage("Both tasks are running. This can take tens of seconds.");
        const poll = await fetch(`/api/scan/status?${params}`);
        const data = await poll.json();
        if (data.status === "success") {
          onScanned(data.scanLabel);
          return;
        }
        if (data.status === "error" || !poll.ok) {
          throw new Error(data.error ?? "That scan failed");
        }
        if (Date.now() > deadline) throw new Error("The scan timed out");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "That scan failed");
    }
  }, [preview, onScanned]);

  const blocking = checks.filter((c) => !c.ok);

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6">
      <h2 className="font-display text-xl">Run a live scan</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        This sends one photo to YouCam and spends {budget.unitsPerScan} units of our{" "}
        {budget.budgetTotal}. {budget.spent} are spent so far and {budget.scansToday} of{" "}
        {budget.dailyCap} live scans have run today. A photo the API rejects costs nothing.
      </p>

      {!budget.liveAvailable ? (
        <p className="mt-4 rounded-lg border border-adjust/25 bg-adjust-soft p-3 text-sm text-ink">
          {budget.reason}
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="press rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-accent"
            >
              {preview ? "Choose a different photo" : "Take or choose a photo"}
            </button>
            {preview && blocking.length === 0 && status !== "scanning" ? (
              <button
                type="button"
                onClick={start}
                className="press rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Scan it, {budget.unitsPerScan} units
              </button>
            ) : null}
          </div>

          {preview ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="The photo you chose" className="rounded-lg border border-line" />
              <ul className="space-y-1.5 text-sm">
                {checks.map((check) => (
                  <li key={check.message} className={check.ok ? "text-muted" : "text-adjust"}>
                    <span aria-hidden className="mr-1.5">{check.ok ? "✓" : "!"}</span>
                    {check.message}
                  </li>
                ))}
                <li className="pt-1 text-xs text-faint">
                  The API also checks that one face fills enough of the frame and is facing forward.
                  If it is not happy it says so, and that costs nothing.
                </li>
              </ul>
            </div>
          ) : null}

          {message ? (
            <p
              className={`mt-4 rounded-lg p-3 text-sm ${status === "error" ? "border border-block/25 bg-block-soft text-block" : "bg-paper text-muted"}`}
            >
              {message}
            </p>
          ) : null}
        </>
      )}

      <button type="button" onClick={onCancel} className="mt-4 text-sm text-muted">
        Use a recorded scan instead
      </button>
    </div>
  );
}
