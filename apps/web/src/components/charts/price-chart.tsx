"use client";

import {
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  LineSeries,
  LineStyle,
  LineType,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketInfo } from "@/lib/chain";
import { clock } from "@/lib/format";
import type { ComplianceChange, Fill, Observation } from "@/lib/types";
import { ChartLegend } from "./legend";
import { bySecond, type Point, ts } from "./series";
import { chartOptions, useChartColors } from "./theme";

interface Props {
  market: MarketInfo;
  observations: Observation[];
  fills: Fill[];
  changes: ComplianceChange[];
  strike: number;
}

interface Readout {
  time?: number;
  ref?: number;
  bid?: number;
  ask?: number;
  fill?: number;
}

export function PriceChart({ market, observations, fills, changes, strike }: Props) {
  const colors = useChartColors();
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<{
    ref: ISeriesApi<"Line">;
    bid: ISeriesApi<"Line">;
    ask: ISeriesApi<"Line">;
    fills: ISeriesApi<"Line">;
    markers: ISeriesMarkersPluginApi<Time>;
    strike: IPriceLine | null;
  } | null>(null);
  const [hover, setHover] = useState<Readout | null>(null);
  const fitted = useRef(false);

  const decimals = Math.max(0, Math.round(Math.log10(Number(market.pricePrecision))));

  const data = useMemo(() => {
    const price = (raw: string | number) => Number(raw) / Number(market.pricePrecision);
    const ref: Point[] = [];
    const bid: Point[] = [];
    const ask: Point[] = [];
    for (const o of observations) {
      const time = ts(o.timestamp);
      ref.push({ time, value: price(o.refPrice) });
      if (o.bestBid !== "0") bid.push({ time, value: price(o.bestBid) });
      if (o.bestAsk !== "0") ask.push({ time, value: price(o.bestAsk) });
    }
    const fillPoints = fills.map((f) => ({
      time: ts(f.timestamp),
      value: price(f.price),
      isBuy: f.makerIsBuy,
    }));
    return { ref: bySecond(ref), bid: bySecond(bid), ask: bySecond(ask), fills: fillPoints };
  }, [observations, fills, market.pricePrecision]);

  useEffect(() => {
    if (!container.current || !colors) return;
    const c = createChart(container.current, chartOptions(colors));
    c.priceScale("right").applyOptions({ scaleMargins: { top: 0.2, bottom: 0.08 } });
    const ref = c.addSeries(LineSeries, {
      color: colors.ink2,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerRadius: 3,
      priceFormat: { type: "price", precision: decimals, minMove: 1 / 10 ** decimals },
    });
    const bid = c.addSeries(LineSeries, {
      color: colors.bid,
      lineWidth: 1,
      lineType: LineType.WithSteps,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const ask = c.addSeries(LineSeries, {
      color: colors.ask,
      lineWidth: 1,
      lineType: LineType.WithSteps,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const fillSeries = c.addSeries(LineSeries, {
      lineVisible: false,
      pointMarkersVisible: true,
      pointMarkersRadius: 2.5,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const markers = createSeriesMarkers(ref, []);
    series.current = { ref, bid, ask, fills: fillSeries, markers, strike: null };
    chart.current = c;

    const onMove = (param: MouseEventParams) => {
      if (!param.time || !series.current) {
        setHover(null);
        return;
      }
      const value = (s: ISeriesApi<"Line">) => {
        const d = param.seriesData.get(s) as { value?: number } | undefined;
        return d?.value;
      };
      setHover({
        time: param.time as number,
        ref: value(series.current.ref),
        bid: value(series.current.bid),
        ask: value(series.current.ask),
        fill: value(series.current.fills),
      });
    };
    c.subscribeCrosshairMove(onMove);
    fitted.current = false;
    return () => {
      c.unsubscribeCrosshairMove(onMove);
      c.remove();
      chart.current = null;
      series.current = null;
    };
  }, [colors, decimals]);

  useEffect(() => {
    const s = series.current;
    if (!s || !colors) return;
    s.ref.setData(data.ref);
    s.bid.setData(data.bid);
    s.ask.setData(data.ask);
    // Fit the whole history once, then leave the viewport to the reader.
    if (!fitted.current && data.ref.length > 0) {
      chart.current?.timeScale().fitContent();
      fitted.current = true;
    }
    s.fills.setData(
      bySecond(
        data.fills.map((f) => ({ time: f.time, value: f.value, color: f.isBuy ? colors.bid : colors.ask })),
      ),
    );
    const refTimes = new Set(data.ref.map((p) => p.time));
    s.markers.setMarkers(
      changes
        .filter((ch) => !ch.compliant && refTimes.has(ts(ch.timestamp)))
        .map((ch) => ({
          time: ts(ch.timestamp),
          position: "aboveBar" as const,
          shape: "arrowDown" as const,
          color: colors.critical,
          text: "Breach",
          size: 0.6,
        }))
        .sort((a, b) => a.time - b.time),
    );
    if (s.strike) s.ref.removePriceLine(s.strike);
    s.strike = s.ref.createPriceLine({
      price: strike,
      color: colors.muted,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "Strike",
    });
  }, [data, changes, strike, colors]);

  const latest = {
    ref: data.ref.at(-1)?.value,
    bid: data.bid.at(-1)?.value,
    ask: data.ask.at(-1)?.value,
  };
  const shown = hover ?? latest;
  const fmt = (v: number | undefined) => (v === undefined ? "—" : v.toFixed(decimals));

  return (
    <div className="relative h-full min-h-0 w-full">
      {colors ? (
        <ChartLegend
          title={`${market.baseSymbol}/${market.quoteSymbol}`}
          time={hover?.time ? clock(hover.time) : undefined}
          items={[
            { key: "ref", label: "Reference", value: fmt(shown.ref), color: colors.ink2 },
            { key: "bid", label: "Covenant bid", value: fmt(shown.bid), color: colors.bid },
            { key: "ask", label: "Covenant ask", value: fmt(shown.ask), color: colors.ask },
            ...(hover?.fill !== undefined
              ? [{ key: "fill", label: "Fill", value: fmt(hover.fill), color: colors.ink }]
              : []),
            {
              key: "strike",
              label: "Strike",
              value: strike.toFixed(decimals),
              color: colors.muted,
              dashed: true,
            },
          ]}
        />
      ) : null}
      <div ref={container} className="absolute inset-0" />
    </div>
  );
}
