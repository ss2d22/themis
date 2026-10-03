import type { ReactNode } from "react";
import { cn } from "./cn";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("flex min-h-0 min-w-0 flex-col bg-panel", className)}>{children}</section>;
}

export function PanelHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex h-8 shrink-0 items-center gap-3 border-b border-line px-3", className)}>
      <h2 className="text-xs font-semibold text-ink">{title}</h2>
      {meta ? <div className="text-xs text-ink-3">{meta}</div> : null}
      {actions ? <div className="ml-auto flex items-center gap-1">{actions}</div> : null}
    </header>
  );
}
