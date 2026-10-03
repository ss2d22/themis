"use client";

import { type ChartOptions, ColorType, CrosshairMode, type DeepPartial, LineStyle } from "lightweight-charts";
import { useEffect, useState } from "react";
import { usePalette, useTheme } from "@/components/shell/preferences";

export interface ChartColors {
  surface: string;
  text: string;
  muted: string;
  grid: string;
  axis: string;
  ink: string;
  ink2: string;
  bid: string;
  ask: string;
  critical: string;
  accent: string;
}

const read = (style: CSSStyleDeclaration, name: string) => style.getPropertyValue(name).trim();

function resolve(): ChartColors {
  const style = getComputedStyle(document.documentElement);
  return {
    surface: read(style, "--panel"),
    text: read(style, "--ink-3"),
    muted: read(style, "--ink-4"),
    grid: read(style, "--line"),
    axis: read(style, "--line-strong"),
    ink: read(style, "--ink"),
    ink2: read(style, "--ink-2"),
    bid: read(style, "--bid"),
    ask: read(style, "--ask"),
    critical: read(style, "--critical"),
    accent: read(style, "--accent"),
  };
}

/** Design tokens resolved to concrete colours, refreshed when the theme or palette changes. */
export function useChartColors(): ChartColors | null {
  const [theme] = useTheme();
  const [palette] = usePalette();
  const [colors, setColors] = useState<ChartColors | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: tokens change with these attributes
  useEffect(() => {
    setColors(resolve());
  }, [theme, palette]);
  return colors;
}

/** `#rrggbb` at the given opacity, as `#rrggbbaa`. Canvas colours cannot use color-mix(). */
export function withAlpha(hex: string, opacity: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  return `${hex}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

export function chartOptions(c: ChartColors): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: c.surface },
      textColor: c.text,
      fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
      fontSize: 11,
      attributionLogo: false,
    },
    grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    rightPriceScale: { borderColor: c.axis, scaleMargins: { top: 0.12, bottom: 0.08 } },
    timeScale: { borderColor: c.axis, timeVisible: true, secondsVisible: false, rightOffset: 4 },
    crosshair: {
      mode: CrosshairMode.Magnet,
      vertLine: { color: c.muted, width: 1, style: LineStyle.Solid, labelBackgroundColor: c.axis },
      horzLine: { color: c.muted, width: 1, style: LineStyle.Solid, labelBackgroundColor: c.axis },
    },
    localization: { locale: "en-US" },
  };
}
