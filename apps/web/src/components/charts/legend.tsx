import type { ReactNode } from "react";

export interface LegendItem {
  key: string;
  label: string;
  value: ReactNode;
  color: string;
  dashed?: boolean;
}

/** TradingView-style readout in the chart's top-left corner. Values lead; line keys mirror the marks. */
export function ChartLegend({ title, items, time }: { title?: string; items: LegendItem[]; time?: string }) {
  return (
    <div className="pointer-events-none absolute top-2 left-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {title ? <span className="font-medium text-ink">{title}</span> : null}
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5">
          <svg width="14" height="2" aria-hidden className="shrink-0">
            <line
              x1="0"
              y1="1"
              x2="14"
              y2="1"
              stroke={item.color}
              strokeWidth="2"
              strokeDasharray={item.dashed ? "3 2" : undefined}
            />
          </svg>
          <span className="text-ink-3">{item.label}</span>
          <span className="num text-ink">{item.value}</span>
        </span>
      ))}
      {time ? <span className="num text-ink-4">{time}</span> : null}
    </div>
  );
}
