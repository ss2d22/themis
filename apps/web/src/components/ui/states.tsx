import type { ReactNode } from "react";

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 px-6 py-8 text-center">
      <p className="text-sm text-ink-2">{title}</p>
      {children ? <p className="max-w-sm text-xs text-ink-3">{children}</p> : null}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 px-6 py-8 text-center">
      <p className="text-sm text-critical">Couldn’t load this data</p>
      <p className="num max-w-md text-xs text-ink-3">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  );
}

export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="h-3 rounded-xs bg-hover" style={{ width: `${90 - ((i * 13) % 40)}%` }} />
      ))}
    </div>
  );
}
