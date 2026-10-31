/**
 * The numbered step rail used by the install pages. The rail joins a step to the
 * next one, so the last step has to say so: `last:hidden` would put it on the
 * list item's first child instead, which is the number, not the rail.
 */
export function Step({
  n,
  title,
  last,
  children,
}: {
  n: number;
  title: string;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="anim-reveal relative flex gap-4" style={{ "--i": n - 1 } as React.CSSProperties}>
      {last ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute left-[15px] top-9 h-[calc(100%-12px)] w-px bg-line"
        />
      )}
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-medium tabular-nums">
        {n}
      </span>
      <div className="min-w-0 pb-7">
        <h3 className="text-[15px] font-medium leading-8">{title}</h3>
        {children ? (
          <div className="mt-1 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
        ) : null}
      </div>
    </li>
  );
}

/** A key to press or a filename to look for. */
export function Key({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-line bg-sunken px-1.5 py-0.5 text-[0.8125rem] text-ink">
      {children}
    </code>
  );
}
