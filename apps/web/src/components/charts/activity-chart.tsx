"use client";

import {
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { clock } from "@/lib/format";
import { ChartLegend } from "./legend";
import { ts } from "./series";
import { chartOptions, useChartColors, withAlpha } from "./theme";

export interface ActivityPoint {
  time: number;
  value: number;
}

/** Every bucket from the first point to now, so empty periods read as zero instead of stretching a bar. */
function zeroFilled(points: ActivityPoint[], bucket: number): ActivityPoint[] {
  if (points.length === 0) return [];
  const byTime = new Map(points.map((p) => [p.time, p.value]));
  const first = points[0]?.time ?? 0;
  const last = Math.max(points.at(-1)?.time ?? first, Math.floor(Date.now() / 1000 / bucket) * bucket);
  const out: ActivityPoint[] = [];
  for (let t = first; t <= last; t += bucket) out.push({ time: t, value: byTime.get(t) ?? 0 });
  return out;
}

/** One series of counts per time bucket. The title names it, so there is no legend box. */
export function ActivityChart({
  title,
  unit,
  points,
  bucket,
  format = (v) => v.toLocaleString("en-US"),
}: {
  title: string;
  unit: string;
  points: ActivityPoint[];
  bucket: number;
  format?: (value: number) => string;
}) {
  const colors = useChartColors();
  const container = useRef<HTMLDivElement>(null);
  const series = useRef<ISeriesApi<"Histogram"> | null>(null);
  const chart = useRef<IChartApi | null>(null);
  const [hover, setHover] = useState<{ time: number; value: number } | null>(null);

  useEffect(() => {
    if (!container.current || !colors) return;
    const c = createChart(container.current, {
      ...chartOptions(colors),
      timeScale: {
        borderColor: colors.axis,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
        barSpacing: 12,
        minBarSpacing: 2,
        maxBarSpacing: 18,
      },
    });
    const s = c.addSeries(HistogramSeries, {
      color: withAlpha(colors.accent, 0.75),
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "custom", formatter: (v: number) => format(v), minMove: 1 },
    });
    c.priceScale("right").applyOptions({ scaleMargins: { top: 0.2, bottom: 0 } });
    series.current = s;
    chart.current = c;
    const onMove = (param: MouseEventParams) => {
      const d = param.time ? (param.seriesData.get(s) as { value?: number } | undefined) : undefined;
      setHover(d?.value !== undefined ? { time: param.time as number, value: d.value } : null);
    };
    c.subscribeCrosshairMove(onMove);
    return () => {
      c.unsubscribeCrosshairMove(onMove);
      c.remove();
      series.current = null;
      chart.current = null;
    };
  }, [colors, format]);

  useEffect(() => {
    series.current?.setData(zeroFilled(points, bucket).map((p) => ({ time: ts(p.time), value: p.value })));
    chart.current?.timeScale().fitContent();
  }, [points, bucket]);

  const total = points.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="relative h-full min-h-0 w-full">
      {colors ? (
        <ChartLegend
          title={title}
          time={hover ? clock(hover.time) : undefined}
          items={[
            {
              key: "v",
              label: hover ? "in bucket" : "total",
              value: `${format(hover ? hover.value : total)} ${unit}`,
              color: colors.accent,
            },
          ]}
        />
      ) : null}
      <div ref={container} className="absolute inset-0 top-7" />
    </div>
  );
}
