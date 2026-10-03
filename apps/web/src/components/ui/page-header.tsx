import type { ReactNode } from "react";

/** Compact page title row: a name, one line of context, optional controls. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 shrink-0 items-center gap-4 border-b border-line bg-panel px-4 py-2">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-base font-semibold text-ink">{title}</h1>
        <p className="truncate text-xs text-ink-3">{description}</p>
      </div>
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
