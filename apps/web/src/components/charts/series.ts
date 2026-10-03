import type { UTCTimestamp } from "lightweight-charts";

export interface Point {
  time: UTCTimestamp;
  value: number;
  color?: string;
}

/** Lightweight Charts needs strictly increasing times; keep the last value in each second. */
export function bySecond(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of [...points].sort((a, b) => a.time - b.time)) {
    const last = out.at(-1);
    if (last && last.time === p.time) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

export const ts = (unixSeconds: string | number | bigint) => Number(unixSeconds) as UTCTimestamp;
