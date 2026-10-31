"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A command with a copy button that confirms. Without the confirmation people
 * press it three more times to check it worked.
 *
 * The clipboard API is unavailable on an insecure origin, so a failed write
 * selects the command instead of leaving a dead button behind.
 */
export function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  const code = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const settle = (next: "copied" | "selected") => {
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      settle("copied");
    } catch {
      const node = code.current;
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      settle("selected");
    }
  }

  return (
    <div>
      {label ? <p className="label mb-1.5 text-faint">{label}</p> : null}
      {/* The button sits beside the command on a wide screen and under it on a
          phone, where taking a column off the command is what forces a URL to
          break across lines. */}
      <div className="flex flex-col rounded-lg border border-line bg-sunken sm:flex-row sm:items-stretch">
        <code
          ref={code}
          /* Wrapping, not scrolling. A command that runs off the edge of a
             phone reads as a shorter command than it is. */
          className="min-w-0 flex-1 whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[0.8125rem] leading-6 text-ink"
        >
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          className="press m-1 shrink-0 self-end rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent sm:self-start"
        >
          {state === "copied" ? "Copied" : state === "selected" ? "Selected" : "Copy"}
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {state === "copied"
          ? "Command copied to the clipboard"
          : state === "selected"
            ? "Could not reach the clipboard. The command is selected, so press control or command C"
            : ""}
      </p>
    </div>
  );
}
