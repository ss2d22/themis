"use client";

import { useMemo } from "react";
import { cn } from "@/components/ui/cn";
import { Loading } from "@/components/ui/states";
import { type BookLevel, type MarketInfo, useBook } from "@/lib/chain";
import type { LiveQuote } from "@/lib/covenant";

const LEVELS = 11;

interface Row {
  price: bigint;
  size: bigint;
  total: bigint;
  covenant: bigint;
  inBand: boolean;
}

function build(
  levels: BookLevel[],
  quotes: LiveQuote[],
  isBuy: boolean,
  ref: bigint,
  bandBps: number,
): Row[] {
  let total = 0n;
  const band = (ref * BigInt(bandBps)) / 10_000n;
  return levels.slice(0, LEVELS).map((l) => {
    total += l.size;
    const covenant = quotes
      .filter((q) => q.isBuy === isBuy && q.price === l.price)
      .reduce((s, q) => s + q.size, 0n);
    const inBand = l.price >= ref - band && l.price <= ref + band;
    return { price: l.price, size: l.size, total, covenant, inBand };
  });
}

/**
 * The live Kuru book for this market, read from chain every second. Bars show each level's size on a square-root
 * scale so one large resting order does not flatten the rest.
 * Covenant quotes are marked, and levels outside the agreed depth band are dimmed because they do not count
 * toward the obligation.
 */
export function OrderBook({
  market,
  quotes,
  refPrice,
  bandBps,
}: {
  market: MarketInfo;
  quotes: LiveQuote[];
  refPrice: bigint;
  bandBps: number;
}) {
  const book = useBook(market.market, 24);
  const decimals = Math.max(0, Math.round(Math.log10(Number(market.pricePrecision))));
  const sizeDecimals = 4;

  const { bids, asks, max, mid, spreadBps } = useMemo(() => {
    const bids = build(book.data?.bids ?? [], quotes, true, refPrice, bandBps);
    const asks = build(book.data?.asks ?? [], quotes, false, refPrice, bandBps);
    const max = [...bids, ...asks].reduce((m, r) => (r.size > m ? r.size : m), 1n);
    const bestBid = bids[0]?.price;
    const bestAsk = asks[0]?.price;
    const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2n : undefined;
    const spreadBps =
      bestBid && bestAsk && mid ? Number(((bestAsk - bestBid) * 1_000_000n) / mid) / 100 : undefined;
    return { bids, asks, max, mid, spreadBps };
  }, [book.data, quotes, refPrice, bandBps]);

  const price = (raw: bigint) => (Number(raw) / Number(market.pricePrecision)).toFixed(decimals);
  const size = (raw: bigint) => (Number(raw) / Number(market.sizePrecision)).toFixed(sizeDecimals);

  const line = (row: Row, side: "bid" | "ask") => (
    <div
      key={`${side}-${row.price}`}
      className={cn(
        "relative grid h-[22px] grid-cols-3 items-center px-3 text-xs",
        !row.inBand && "opacity-45",
      )}
      title={
        row.covenant > 0n
          ? `Covenant quotes ${size(row.covenant)} ${market.baseSymbol} of ${size(row.size)} at this price`
          : undefined
      }
    >
      <span
        className={cn("absolute inset-y-[2px] right-0", side === "bid" ? "bg-bid-soft" : "bg-ask-soft")}
        style={{ width: `${Math.sqrt(Number((row.size * 10_000n) / max) / 10_000) * 100}%` }}
        aria-hidden
      />
      {row.covenant > 0n ? (
        <span className="absolute inset-y-[3px] left-0 w-[3px] rounded-r-xs bg-accent" aria-hidden />
      ) : null}
      <span className={cn("num relative", side === "bid" ? "text-bid" : "text-ask")}>{price(row.price)}</span>
      <span className="num relative text-right text-ink-2">{size(row.size)}</span>
      <span className="num relative text-right text-ink-3">{size(row.total)}</span>
    </div>
  );

  if (book.isLoading) return <Loading rows={10} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid h-6 shrink-0 grid-cols-3 items-center px-3 text-2xs text-ink-3">
        <span>Price {market.quoteSymbol}</span>
        <span className="text-right">Size {market.baseSymbol}</span>
        <span className="text-right">Total</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
        {[...asks].reverse().map((r) => line(r, "ask"))}
      </div>
      <div className="flex h-8 shrink-0 items-center gap-3 border-y border-line bg-raised px-3 text-xs">
        <span className="num text-sm font-medium text-ink">{mid ? price(mid) : "—"}</span>
        <span className="text-ink-3">mid</span>
        <span className="num ml-auto text-ink-2">
          {spreadBps !== undefined ? `${spreadBps.toFixed(1)} bps` : "—"}
        </span>
        <span className="text-ink-3">spread</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{bids.map((r) => line(r, "bid"))}</div>
      <div className="flex h-7 shrink-0 items-center gap-3 border-t border-line px-3 text-2xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-[3px] rounded-xs bg-accent" aria-hidden /> Covenant quote
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-ink-4 opacity-45" aria-hidden /> Outside ±{bandBps / 100}
          % band
        </span>
      </div>
    </div>
  );
}
