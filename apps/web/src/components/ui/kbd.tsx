import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-xs border border-line-strong px-1 font-mono text-2xs text-ink-3">
      {children}
    </kbd>
  );
}
