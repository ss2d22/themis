"use client";

import {
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  LineSeries,
  LineStyle,
  LineType,
  type MouseEventParams,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { clock, compact } from "@/lib/format";
import type { Observation } from "@/lib/types";
import { ChartLegend } from "./legend";
import { bySecond, type Point, ts } from "./series";
import { chartOptions, useChartColors } from "./theme";

interface Props {
  observations: Observation[];
  quoteDecimals: number;
  quoteSymbol: string;
  minBid: number;
  minAsk: number;
}

/** Bid and ask depth inside the covenant band, in quote currency, against the agreed minimum. */
export function DepthChart({ observations, quoteDecimals, quoteSymbol, minBid, minAsk }: Props) {
  const colors = useChartColors();
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<{ bid: ISeriesApi<"Line">; ask: ISeriesApi<"Line">; lines: IPriceLine[] } | null>(
    null,
  );
  const [hover, setHover] = useState<{ time: number; bid?: number; ask?: number } | null>(null);

  const data = useMemo(() => {
    const scale = 10 ** quoteDecimals;
    const bid: Point[] = [];
    const ask: Point[] = [];
    for (const o of observations) {
      bid.push({ time: ts(o.timestamp), value: Number(o.bidDepth) / scale });
      ask.push({ time: ts(o.timestamp), value: Number(o.askDepth) / scale });
    }
    return { bid: bySecond(bid), ask: bySecond(ask) };
  }, [observations, quoteDecimals]);

  useEffect(() => {
    if (!container.current || !colors) return;
    const c = createChart(container.current, chartOptions(colors));
    const format = { type: "custom" as const, formatter: (v: number) => compact(v), minMove: 0.01 };
    const bid = c.addSeries(LineSeries, {
      color: colors.bid,
      lineWidth: 2,
      lineType: LineType.WithSteps,
      priceLineVisible: false,
      priceFormat: format,
    });
    const ask = c.addSeries(LineSeries, {
      color: colors.ask,
      lineWidth: 2,
      lineType: LineType.WithSteps,
      priceLineVisible: false,
      priceFormat: format,
    });
    c.priceScale("right").applyOptions({ scaleMargins: { top: 0.18, bottom: 0.02 } });
    series.current = { bid, ask, lines: [] };
    chart.current = c;

    const onMove = (param: MouseEventParams) => {
      if (!param.time || !series.current) return setHover(null);
      const v = (s: ISeriesApi<"Line">) => (param.seriesData.get(s) as { value?: number } | undefined)?.value;
      setHover({ time: param.time as number, bid: v(series.current.bid), ask: v(series.current.ask) });
    };
    c.subscribeCrosshairMove(onMove);
    return () => {
      c.unsubscribeCrosshairMove(onMove);
      c.remove();
      chart.current = null;
      series.current = null;
    };
  }, [colors]);

  useEffect(() => {
    const s = series.current;
    if (!s || !colors) return;
    s.bid.setData(data.bid);
    s.ask.setData(data.ask);
    for (const line of s.lines) s.bid.removePriceLine(line);
    const threshold = (price: number, title: string) =>
      s.bid.createPriceLine({
        price,
        color: colors.critical,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title,
      });
    s.lines =
      minBid === minAsk
        ? [threshold(minBid, "Minimum depth")]
        : [threshold(minBid, "Minimum bid"), threshold(minAsk, "Minimum ask")];
  }, [data, colors, minBid, minAsk]);

  const shown = hover ?? { bid: data.bid.at(-1)?.value, ask: data.ask.at(-1)?.value };
  const fmt = (v: number | undefined) => (v === undefined ? "—" : `${compact(v)} ${quoteSymbol}`);

  return (
    <div className="relative h-full min-h-0 w-full">
      {colors ? (
        <ChartLegend
          title="Depth in band"
          time={hover?.time ? clock(hover.time) : undefined}
          items={[
            { key: "bid", label: "Bid", value: fmt(shown.bid), color: colors.bid },
            { key: "ask", label: "Ask", value: fmt(shown.ask), color: colors.ask },
            {
              key: "min",
              label: "Minimum",
              value: fmt(Math.min(minBid, minAsk)),
              color: colors.critical,
              dashed: true,
            },
          ]}
        />
      ) : null}
      <div ref={container} className="absolute inset-0" />
    </div>
  );
}
