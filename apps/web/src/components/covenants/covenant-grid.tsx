"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";
import { Address } from "@/components/ui/address";
import { cn } from "@/components/ui/cn";
import { type Column, DataTable } from "@/components/ui/data-table";
import { Empty, ErrorState, Loading } from "@/components/ui/states";
import { ComplianceBadge, StatusBadge } from "@/components/ui/status";
import { useEngagements } from "@/lib/api";
import type { MarketInfo } from "@/lib/chain";
import { useHead } from "@/lib/chain";
import { blocksToDuration, bps, compact, percentFromBps, toNumber } from "@/lib/format";
import { pairName, useMarkets } from "@/lib/markets";
import { blocksLeft, spreadBps, vestedFraction } from "@/lib/metrics";
import { type Engagement, templateLabel } from "@/lib/types";
import { TargetMeter } from "./meter";

const views = ["all", "active", "breach", "closed"] as const;
type View = (typeof views)[number];

const matches: Record<View, (e: Engagement) => boolean> = {
  all: () => true,
  active: (e) => e.status === 2,
  breach: (e) => (e.status === 2 && !e.compliant) || e.status === 3,
  closed: (e) => e.status >= 4,
};

type Row = Engagement & { info: MarketInfo | undefined; head: bigint };

const depth = (row: Row, value: string | null) =>
  row.info && value ? toNumber(value, row.info.quoteDecimals) : 0;

function DepthCell({ row, value, target }: { row: Row; value: number; target: string }) {
  if (row.status !== 2 || !row.info) return <span className="text-ink-4">—</span>;
  return <span className={cn(value < depth(row, target) && "text-critical")}>{compact(value)}</span>;
}

const columns: Column<Row>[] = [
  {
    id: "id",
    header: "#",
    accessorFn: (e) => Number(e.id),
    size: 56,
    cell: (c) => <span className="num text-ink">{c.getValue<number>()}</span>,
  },
  {
    id: "market",
    header: "Market",
    accessorFn: (e) => pairName(e.info),
    size: 110,
    cell: (c) => <span className="font-medium text-ink">{c.getValue<string>()}</span>,
  },
  {
    id: "type",
    header: "Type",
    accessorFn: (e) => e.terms.template ?? 0,
    size: 110,
    cell: (c) => <span className="text-ink-2">{templateLabel[c.row.original.terms.template ?? 0]}</span>,
  },
  {
    id: "maker",
    header: "Operator",
    accessorFn: (e) => e.maker,
    size: 130,
    cell: (c) => <Address address={c.getValue<string>()} />,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (e) => e.status,
    size: 110,
    cell: (c) => <StatusBadge status={c.row.original.status} />,
  },
  {
    id: "live",
    header: "Book",
    accessorFn: (e) => (e.status === 2 ? (e.compliant ? 1 : 0) : -1),
    size: 120,
    cell: (c) =>
      c.row.original.status === 2 ? (
        <ComplianceBadge compliant={c.row.original.compliant} />
      ) : (
        <span className="text-ink-4">—</span>
      ),
  },
  {
    id: "uptime",
    header: "Uptime",
    accessorFn: (e) => e.uptimeBps,
    size: 130,
    meta: { align: "right" },
    cell: (c) => {
      const e = c.row.original;
      return (
        <TargetMeter
          value={e.uptimeBps}
          target={e.terms.ob.uptimeTargetBps}
          max={10_000}
          label={percentFromBps(e.uptimeBps)}
        />
      );
    },
  },
  {
    id: "spread",
    header: "Spread",
    accessorFn: (e) => spreadBps(e) ?? Number.POSITIVE_INFINITY,
    size: 96,
    meta: { align: "right" },
    cell: (c) => {
      const e = c.row.original;
      const s = spreadBps(e);
      if (s === null || e.status !== 2) return <span className="text-ink-4">—</span>;
      return <span className={cn(s > e.terms.ob.maxSpreadBps && "text-critical")}>{bps(s, 1)}</span>;
    },
  },
  {
    id: "bid",
    header: () => (
      <>
        Bid depth <span className="text-ink-4">USDC</span>
      </>
    ),
    accessorFn: (e) => depth(e, e.bidDepth),
    size: 124,
    meta: { align: "right" },
    cell: (c) => (
      <DepthCell
        row={c.row.original}
        value={c.getValue<number>()}
        target={c.row.original.terms.ob.minBidDepth}
      />
    ),
  },
  {
    id: "ask",
    header: () => (
      <>
        Ask depth <span className="text-ink-4">USDC</span>
      </>
    ),
    accessorFn: (e) => depth(e, e.askDepth),
    size: 124,
    meta: { align: "right" },
    cell: (c) => (
      <DepthCell
        row={c.row.original}
        value={c.getValue<number>()}
        target={c.row.original.terms.ob.minAskDepth}
      />
    ),
  },
  {
    id: "vested",
    header: "Vested",
    accessorFn: (e) => vestedFraction(e),
    size: 80,
    meta: { align: "right" },
    cell: (c) => `${(c.getValue<number>() * 100).toFixed(1)}%`,
  },
  {
    id: "epochs",
    header: "Epochs",
    accessorFn: (e) => e.epochsPassed + e.epochsFailed,
    size: 92,
    meta: { align: "right" },
    cell: (c) => (
      <span>
        {c.row.original.epochsPassed}
        <span className="text-ink-4"> / </span>
        <span className={cn(c.row.original.epochsFailed > 0 && "text-critical")}>
          {c.row.original.epochsFailed}
        </span>
      </span>
    ),
  },
  { id: "fills", header: "Fills", accessorFn: (e) => e.fills, size: 72, meta: { align: "right" } },
  {
    id: "ends",
    header: "Ends in",
    accessorFn: (e) => Number(blocksLeft(e, e.head) ?? -1n),
    size: 92,
    meta: { align: "right", grow: true },
    cell: (c) => {
      const left = blocksLeft(c.row.original, c.row.original.head);
      if (left === null || c.row.original.status >= 4) return <span className="text-ink-4">—</span>;
      return left === 0n ? "matured" : blocksToDuration(left);
    },
  },
];

export function CovenantGrid() {
  const router = useRouter();
  const { data, error, isLoading } = useEngagements();
  const head = useHead().data?.block ?? 0n;
  const markets = useMarkets((data ?? []).map((e) => e.market));
  const [view, setView] = useQueryState("view", parseAsStringLiteral(views).withDefault("all"));

  const rows = useMemo<Row[]>(
    () =>
      (data ?? [])
        .filter(matches[view])
        .map((e) => ({ ...e, info: markets.get(e.market.toLowerCase()), head })),
    [data, view, markets, head],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(views.map((v) => [v, (data ?? []).filter(matches[v]).length])) as Record<
        View,
        number
      >,
    [data],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-3">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "flex h-6 shrink-0 items-center gap-1.5 rounded-sm px-2 text-xs font-medium whitespace-nowrap capitalize",
              view === v ? "bg-active text-ink" : "text-ink-3 hover:bg-hover hover:text-ink-2",
            )}
          >
            {v === "breach" ? "In breach" : v}
            <span className="num text-2xs text-ink-4">{counts[v]}</span>
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-ink-3 sm:inline">
          Click a row for the live report card
        </span>
      </div>
      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <Loading rows={8} />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(e) => e.id}
          initialSort={[{ id: "id", desc: true }]}
          onRowClick={(e) => router.push(`/c/${e.id}`)}
          empty={
            <Empty title={view === "all" ? "No covenants yet" : "Nothing in this view"}>
              {view === "all"
                ? "Agreements appear here as soon as an issuer proposes one on chain."
                : undefined}
            </Empty>
          }
        />
      )}
    </div>
  );
}
