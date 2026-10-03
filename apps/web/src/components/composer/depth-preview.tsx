"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BookLevel, MarketInfo } from "@/lib/chain";
import { compact } from "@/lib/format";

const HEIGHT = 220;
const PAD = { top: 16, right: 56, bottom: 22, left: 8 };

interface Props {
  market: MarketInfo;
  bids: BookLevel[];
  asks: BookLevel[];
  mid: bigint;
  bandBps: number;
  minBid: bigint;
  minAsk: bigint;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The live Kuru book as cumulative depth in quote currency, with the covenant's band shaded and the depth it
 * requires drawn as thresholds. Shows at a glance whether today's book would already comply.
 */
export function DepthPreview({ market, bids, asks, mid, bandBps, minBid, minAsk }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ x: number; price: number; depth: number; side: "bid" | "ask" } | null>(
    null,
  );
  const pp = Number(market.pricePrecision);
  const scale = 10 ** market.quoteDecimals;
  const midPrice = Number(mid) / pp;
  const half = Math.max((bandBps / 10_000) * 2, 0.01) * midPrice;
  const lo = midPrice - half;
  const hi = midPrice + half;
  const bandLo = midPrice * (1 - bandBps / 10_000);
  const bandHi = midPrice * (1 + bandBps / 10_000);

  const curves = useMemo(() => {
    const cumulative = (levels: BookLevel[]) => {
      let total = 0;
      return levels.map((l) => {
        const price = Number(l.price) / pp;
        total += (Number(l.size) / Number(market.sizePrecision)) * price;
        return { price, total };
      });
    };
    const b = cumulative(bids).filter((p) => p.price >= lo);
    const a = cumulative(asks).filter((p) => p.price <= hi);
    const inBand = (pts: { price: number; total: number }[], test: (p: number) => boolean) =>
      pts.filter((p) => test(p.price)).at(-1)?.total ?? 0;
    return {
      b,
      a,
      bidInBand: inBand(b, (p) => p >= bandLo),
      askInBand: inBand(a, (p) => p <= bandHi),
    };
  }, [bids, asks, pp, market.sizePrecision, lo, hi, bandLo, bandHi]);

  const reqBid = Number(minBid) / scale;
  const reqAsk = Number(minAsk) / scale;
  const yMax = Math.max(reqBid, reqAsk, curves.b.at(-1)?.total ?? 0, curves.a.at(-1)?.total ?? 0, 1) * 1.15;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (price: number) => PAD.left + ((price - lo) / (hi - lo)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const stepPath = (pts: { price: number; total: number }[], side: "bid" | "ask") => {
    if (pts.length === 0) return "";
    const start = side === "bid" ? midPrice : midPrice;
    let d = `M ${x(start)} ${y(0)}`;
    let prev = 0;
    for (const p of pts) {
      d += ` L ${x(p.price)} ${y(prev)} L ${x(p.price)} ${y(p.total)}`;
      prev = p.total;
    }
    d += ` L ${x(side === "bid" ? lo : hi)} ${y(prev)}`;
    return d;
  };
  const area = (path: string, side: "bid" | "ask") =>
    path ? `${path} L ${x(side === "bid" ? lo : hi)} ${y(0)} Z` : "";
  const bidPath = stepPath(curves.b, "bid");
  const askPath = stepPath(curves.a, "ask");
  const ticks = [lo, bandLo, midPrice, bandHi, hi];

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const price = lo + ((px - PAD.left) / plotW) * (hi - lo);
    if (price < lo || price > hi) return setHover(null);
    const side = price < midPrice ? "bid" : "ask";
    const pts =
      side === "bid" ? curves.b.filter((p) => p.price >= price) : curves.a.filter((p) => p.price <= price);
    setHover({ x: px, price, depth: pts.at(-1)?.total ?? 0, side });
  };

  const bidOk = curves.bidInBand >= reqBid;
  const askOk = curves.askInBand >= reqAsk;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs">
        <span className="text-ink-3">Live Kuru book, depth in {market.quoteSymbol}</span>
        <span className="num ml-auto text-ink-3">
          {hover
            ? `${hover.side === "bid" ? "Bids" : "Asks"} to ${hover.price.toFixed(2)}: ${compact(hover.depth)}`
            : `mid ${midPrice.toFixed(2)}`}
        </span>
      </div>
      <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label="Order book depth against the covenant requirement"
          >
            <rect
              x={x(bandLo)}
              y={PAD.top}
              width={x(bandHi) - x(bandLo)}
              height={plotH}
              fill="var(--accent-soft)"
            />
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" />
            <path d={area(bidPath, "bid")} fill="var(--bid-soft)" />
            <path d={area(askPath, "ask")} fill="var(--ask-soft)" />
            <path d={bidPath} fill="none" stroke="var(--bid)" strokeWidth={1.5} />
            <path d={askPath} fill="none" stroke="var(--ask)" strokeWidth={1.5} />
            <line
              x1={x(bandLo)}
              x2={x(midPrice)}
              y1={y(reqBid)}
              y2={y(reqBid)}
              stroke="var(--critical)"
              strokeDasharray="4 3"
            />
            <line
              x1={x(midPrice)}
              x2={x(bandHi)}
              y1={y(reqAsk)}
              y2={y(reqAsk)}
              stroke="var(--critical)"
              strokeDasharray="4 3"
            />
            <text
              x={PAD.left + plotW + 6}
              y={y(Math.max(reqBid, reqAsk)) + 3}
              className="fill-ink-3 font-mono text-[10px]"
            >
              {compact(Math.max(reqBid, reqAsk))}
            </text>
            <text
              x={PAD.left + plotW + 6}
              y={y(yMax / 1.15) + 3}
              className="fill-ink-4 font-mono text-[10px]"
            >
              {compact(yMax / 1.15)}
            </text>
            {ticks.map((t, i) => (
              <text
                key={t}
                x={x(t)}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
                className="fill-ink-3 font-mono text-[10px]"
              >
                {t.toFixed(t > 1000 ? 0 : 2)}
              </text>
            ))}
            <text x={x(midPrice)} y={PAD.top - 4} textAnchor="middle" className="fill-ink-3 text-[10px]">
              ±{bandBps / 100}% band
            </text>
            {hover ? (
              <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--ink-4)" />
            ) : null}
          </svg>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <p className={bidOk ? "text-ink-2" : "text-critical"}>
          Bids in band today {compact(curves.bidInBand)} of {compact(reqBid)} required
        </p>
        <p className={askOk ? "text-right text-ink-2" : "text-right text-critical"}>
          Asks in band today {compact(curves.askInBand)} of {compact(reqAsk)} required
        </p>
      </div>
    </div>
  );
}
