"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Num } from "@/components/ui/num";
import type { MarketInfo } from "@/lib/chain";
import type { LiveCovenant } from "@/lib/covenant";
import { percentFromBps, units } from "@/lib/format";
import type { Engagement } from "@/lib/types";

function Metric({
  label,
  value,
  numeric,
  sub,
  breach,
  progress,
}: {
  label: string;
  value: string;
  numeric: number;
  sub: ReactNode;
  breach?: boolean;
  progress?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
      <span className="label truncate">{label}</span>
      <Num
        value={numeric}
        display={value}
        className={cn("text-sm font-medium text-ink", breach && "text-critical")}
      />
      <span className="truncate text-2xs text-ink-3" title={typeof sub === "string" ? sub : undefined}>
        {sub}
      </span>
      {progress !== undefined ? (
        <span className="mt-1 h-[3px] w-full rounded-full bg-hover" aria-hidden>
          <span
            className="block h-full rounded-full bg-ink-3"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

export function MetricStrip({
  e,
  live,
  market,
}: {
  e: Engagement;
  live: LiveCovenant | undefined;
  market: MarketInfo;
}) {
  const m = live?.metrics;
  const ob = e.terms.ob;
  const q = (v: bigint | string) => units(v, market.quoteDecimals, 0);
  const b = (v: bigint | string, f = 3) => units(v, market.baseDecimals, f);
  const active = e.status === 2;

  const spread = m ? Number(m.spreadBps) : 0;
  const allowed = m ? Number(m.allowedSpreadBps) : ob.maxSpreadBps;
  const bid = m?.bidDepth ?? 0n;
  const ask = m?.askDepth ?? 0n;
  const vested = live?.vested ?? 0n;
  const options = BigInt(e.terms.options);
  const retainer = live?.retainerEarned ?? 0n;
  const bondLeft = live?.engagement.bondLeft ?? 0n;
  const netSold = live?.netSold ?? 0n;
  const maxNetSell = BigInt(e.terms.risk.maxNetSell);

  return (
    <div className="grid shrink-0 grid-cols-9 divide-x divide-line border-b border-line bg-panel">
      <Metric
        label="Spread"
        value={active && m && m.bestBid > 0 ? `${spread} bps` : "—"}
        numeric={spread}
        breach={active && spread > allowed}
        sub={`max ${allowed} bps${allowed !== ob.maxSpreadBps ? " (volatile)" : ""}`}
      />
      <Metric
        label="Bid depth"
        value={active ? q(bid) : "—"}
        numeric={Number(bid)}
        breach={active && bid < BigInt(ob.minBidDepth)}
        sub={`min ${q(ob.minBidDepth)} ${market.quoteSymbol} in ±${ob.depthBandBps / 100}%`}
      />
      <Metric
        label="Ask depth"
        value={active ? q(ask) : "—"}
        numeric={Number(ask)}
        breach={active && ask < BigInt(ob.minAskDepth)}
        sub={`min ${q(ob.minAskDepth)} ${market.quoteSymbol} in ±${ob.depthBandBps / 100}%`}
      />
      <Metric
        label="Uptime to date"
        value={percentFromBps(e.uptimeBps)}
        numeric={e.uptimeBps}
        breach={e.uptimeBps < ob.uptimeTargetBps}
        sub={`target ${percentFromBps(ob.uptimeTargetBps, 0)} per epoch`}
      />
      <Metric
        label="Failing streak"
        value={`${e.failingStreak} of ${ob.sustainedBreachEpochs}`}
        numeric={e.failingStreak}
        breach={e.failingStreak > 0}
        sub="failed epochs in a row"
      />
      <Metric
        label="Options vested"
        value={b(vested)}
        numeric={Number(vested)}
        sub={`of ${b(options)} ${market.baseSymbol} @ ${(e.terms.strike / Number(market.pricePrecision)).toLocaleString("en-US")}`}
        progress={options > 0n ? Number(vested) / Number(options) : 0}
      />
      <Metric
        label="Retainer earned"
        value={units(retainer, market.quoteDecimals)}
        numeric={Number(retainer)}
        sub={`of ${q(e.terms.retainer)} ${market.quoteSymbol}`}
        progress={BigInt(e.terms.retainer) > 0n ? Number(retainer) / Number(e.terms.retainer) : 0}
      />
      <Metric
        label="Bond left"
        value={active || e.status === 3 ? units(bondLeft, market.quoteDecimals) : "—"}
        numeric={Number(bondLeft)}
        sub={
          active || e.status === 3
            ? `of ${q(e.terms.bond)} posted`
            : e.status === 1
              ? `${q(e.terms.bond)} due on accept`
              : "distributed at close"
        }
        progress={
          (active || e.status === 3) && BigInt(e.terms.bond) > 0n
            ? Number(bondLeft) / Number(e.terms.bond)
            : undefined
        }
      />
      <Metric
        label="Net sold"
        value={active ? b(netSold) : "—"}
        numeric={Number(netSold)}
        sub={`limit ${b(maxNetSell, 2)} ${market.baseSymbol} per window`}
        progress={active && maxNetSell > 0n ? Number(netSold) / Number(maxNetSell) : undefined}
      />
    </div>
  );
}
