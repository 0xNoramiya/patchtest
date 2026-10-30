import { Suspense } from "react";
import { CheckFlow } from "./CheckFlow";

export const metadata = { title: "Check a cart | PatchTest" };

export default function CheckPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-3xl px-4 py-16 text-muted">Loading…</div>}
    >
      <CheckFlow />
    </Suspense>
  );
}
