"use client";

import { Num } from "@/components/ui/num";
import { useStats } from "@/lib/api";
import { blocksToDuration, compact, units } from "@/lib/format";

function Tile({
  label,
  value,
  display,
  sub,
}: {
  label: string;
  value: number;
  display?: string;
  sub?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5">
      <span className="label">{label}</span>
      <span className="text-[17px] leading-6 font-medium text-ink">
        <Num value={value} display={display} className="font-sans" />
      </span>
      {sub ? <span className="truncate text-2xs text-ink-3">{sub}</span> : null}
    </div>
  );
}

export function StatsRibbon() {
  const { data } = useStats();
  const s = data;
  const credited = s ? Number(s.blocksCredited) : 0;
  return (
    <div className="grid shrink-0 grid-cols-7 divide-x divide-line border-b border-line bg-panel">
      <Tile
        label="Covenants"
        value={s?.engagements ?? 0}
        sub={`${s?.settlements ?? 0} settled · ${s?.clawbacks ?? 0} clawed back`}
      />
      <Tile
        label="Liquidity credited"
        value={credited}
        display={blocksToDuration(credited)}
        sub={`${compact(credited)} blocks`}
      />
      <Tile
        label="Quotes gated"
        value={s?.quotes ?? 0}
        display={compact(s?.quotes ?? 0)}
        sub="post-only, in band"
      />
      <Tile
        label="Fills served"
        value={s?.fills ?? 0}
        display={compact(s?.fills ?? 0)}
        sub="against covenant quotes"
      />
      <Tile label="Breaches caught" value={s?.breaches ?? 0} sub={`${s?.epochsClosed ?? 0} epochs closed`} />
      <Tile
        label="Observations"
        value={s?.observations ?? 0}
        display={compact(s?.observations ?? 0)}
        sub="book checks on chain"
      />
      <Tile
        label="Bounties paid"
        value={s ? Number(s.bountiesPaid) : 0}
        display={s ? `${units(s.bountiesPaid, 6)}` : "0.00"}
        sub={`USDC to ${s?.watchers ?? 0} watchtowers`}
      />
    </div>
  );
}
