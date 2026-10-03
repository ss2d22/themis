"use client";

import { CircleCheck, CircleDot, CircleX, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { type Address, parseUnits } from "viem";
import { Address as AddressLink, TxLink } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { type Column, DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Empty, ErrorState, Loading } from "@/components/ui/states";
import { useEngagements, useOutcomes } from "@/lib/api";
import type { MarketInfo } from "@/lib/chain";
import { blocksToDuration, shortAddress, units } from "@/lib/format";
import { pairName, useMarkets } from "@/lib/markets";
import { useOutcomeActions, useOutcomeBalances, useOutcomeProgress } from "@/lib/outcome";
import type { Engagement, OutcomeMarket } from "@/lib/types";

type Row = OutcomeMarket & { engagement: Engagement | undefined; info: MarketInfo | undefined };

function OutcomeBadge({ outcome }: { outcome: OutcomeMarket["outcome"] }) {
  if (outcome === 1)
    return (
      <span className="flex items-center gap-1 text-good">
        <CircleCheck size={12} /> Kept
      </span>
    );
  if (outcome === 2)
    return (
      <span className="flex items-center gap-1 text-critical">
        <CircleX size={12} /> Broken
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-accent">
      <CircleDot size={12} /> Open
    </span>
  );
}

const epochs = (r: OutcomeMarket) =>
  r.epochCount === 1 ? `Epoch ${r.firstEpoch}` : `Epochs ${r.firstEpoch}–${r.firstEpoch + r.epochCount - 1}`;

const columns: Column<Row>[] = [
  {
    id: "id",
    header: "#",
    accessorFn: (r) => Number(r.id),
    size: 52,
    cell: (c) => <span className="num text-ink">{c.row.original.id}</span>,
  },
  {
    id: "covenant",
    header: "Covenant",
    accessorFn: (r) => Number(r.engagementId),
    size: 150,
    cell: (c) => (
      <Link
        href={`/c/${c.row.original.engagementId}`}
        onClick={(e) => e.stopPropagation()}
        className="hover:text-accent"
      >
        <span className="font-medium text-ink">{pairName(c.row.original.info)}</span>{" "}
        <span className="num text-ink-3">#{c.row.original.engagementId}</span>
      </Link>
    ),
  },
  {
    id: "period",
    header: "Period",
    accessorFn: (r) => r.firstEpoch,
    size: 120,
    cell: (c) => epochs(c.row.original),
  },
  {
    id: "question",
    header: "Pays KEPT if",
    accessorFn: (r) => r.engagement?.terms.ob.uptimeTargetBps ?? 0,
    size: 200,
    enableSorting: false,
    cell: (c) => {
      const e = c.row.original.engagement;
      return e ? `uptime ≥ ${e.terms.ob.uptimeTargetBps / 100}% and no clawback` : "—";
    },
  },
  {
    id: "outcome",
    header: "Outcome",
    accessorFn: (r) => r.outcome,
    size: 100,
    cell: (c) => <OutcomeBadge outcome={c.row.original.outcome} />,
  },
  {
    id: "oi",
    header: "Open sets USDC",
    accessorFn: (r) => Number(r.outstanding),
    size: 140,
    meta: { align: "right", grow: true },
    cell: (c) => units(c.row.original.outstanding, c.row.original.info?.quoteDecimals ?? 6),
  },
];

function Ticket({ row }: { row: Row }) {
  const e = row.engagement;
  const info = row.info;
  const progress = useOutcomeProgress(row, e?.terms.ob.uptimeTargetBps).data;
  const balances = useOutcomeBalances(row, info?.quote as Address | undefined).data;
  const actions = useOutcomeActions(row.id, info?.quote as Address | undefined);
  const [amount, setAmount] = useState("100");
  if (!e || !info) return <Loading />;

  const decimals = info.quoteDecimals;
  const raw = (() => {
    try {
      return parseUnits(amount || "0", decimals);
    } catch {
      return 0n;
    }
  })();
  const needsApproval = balances ? balances.allowance < raw : false;
  const pct = (a: bigint, b: bigint) => (b > 0n ? Number((a * 10_000n) / b) / 100 : 0);
  const fmt = (v: bigint) => units(v, decimals);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <p className="text-sm text-ink">
          Will <span className="num">{shortAddress(e.maker)}</span> keep {pairName(info)} covenant #{e.id} at
          ≥ {e.terms.ob.uptimeTargetBps / 100}% uptime through {epochs(row).toLowerCase()}?
        </p>
        <p className="text-xs text-ink-3">
          One {info.quoteSymbol} mints one KEPT and one BROKEN. The winner redeems for one {info.quoteSymbol},
          settled from the escrow’s own ledger with no oracle.
        </p>
      </div>

      {progress ? (
        <div className="flex flex-col gap-2 border-b border-line p-3 text-xs">
          <h3 className="label">Ledger so far</h3>
          <div className="relative h-2 rounded-full bg-hover" aria-hidden>
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-ink-3"
              style={{ width: `${pct(progress.credited, progress.length)}%` }}
            />
            <span
              className="absolute -top-1 -bottom-1 w-px bg-ink"
              style={{ left: `${progress.targetBps / 100}%` }}
              title={`Target ${progress.targetBps / 100}%`}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-ink-3">Credited</dt>
            <dd className="num text-right text-ink-2">
              {progress.credited.toLocaleString()} / {progress.length.toLocaleString()} blocks
            </dd>
            <dt className="text-ink-3">Elapsed</dt>
            <dd className="num text-right text-ink-2">
              {blocksToDuration(progress.elapsed)} of {blocksToDuration(progress.length)}
            </dd>
            <dt className="text-ink-3">Missed</dt>
            <dd
              className={cn(
                "num text-right",
                progress.missed > progress.allowance ? "text-critical" : "text-ink-2",
              )}
            >
              {progress.missed.toLocaleString()} of {progress.allowance.toLocaleString()} allowed
            </dd>
          </dl>
          <p className={cn("text-xs", progress.decided === "broken-locked" ? "text-critical" : "text-ink-3")}>
            {row.outcome !== 0
              ? `Resolved ${row.outcome === 1 ? "KEPT" : "BROKEN"} from ${row.credited ?? "—"} credited of ${row.length ?? "—"} blocks.`
              : progress.decided === "broken-locked"
                ? "More blocks were missed than the target allows. KEPT can no longer win."
                : `Still open: ${(progress.allowance - progress.missed).toLocaleString()} more blocks can be missed before KEPT is out of reach.`}
          </p>
        </div>
      ) : (
        <Loading rows={3} />
      )}

      <div className="flex flex-col gap-2 border-b border-line p-3 text-xs">
        <h3 className="label">Tokens</h3>
        <div className="flex items-center justify-between">
          <span className="text-ink-3">KEPT</span>
          <AddressLink address={row.kept} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-3">BROKEN</span>
          <AddressLink address={row.broken} />
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3 text-xs">
        <h3 className="label">Trade</h3>
        {actions.connected ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Balance label="KEPT" value={balances ? fmt(balances.kept) : "—"} />
              <Balance label="BROKEN" value={balances ? fmt(balances.broken) : "—"} />
              <Balance label={info.quoteSymbol} value={balances ? fmt(balances.cash) : "—"} />
            </div>
            <label className="flex h-7 items-center rounded-sm border border-line-strong bg-bg focus-within:border-accent">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                className="num h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-ink outline-none"
                aria-label="Amount"
              />
              <span className="px-2 text-ink-3">{info.quoteSymbol}</span>
            </label>
            {row.outcome === 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {needsApproval ? (
                  <Button
                    variant="primary"
                    disabled={actions.pending !== null}
                    onClick={() => actions.run("approve", 0n)}
                  >
                    {actions.pending === "approve" ? (
                      <LoaderCircle size={12} className="animate-spin" />
                    ) : null}{" "}
                    Approve {info.quoteSymbol}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={raw === 0n || actions.pending !== null}
                    onClick={() => actions.run("mintSet", raw)}
                  >
                    {actions.pending === "mintSet" ? (
                      <LoaderCircle size={12} className="animate-spin" />
                    ) : null}{" "}
                    Mint set
                  </Button>
                )}
                <Button
                  disabled={raw === 0n || actions.pending !== null}
                  onClick={() => actions.run("redeemSet", raw)}
                >
                  {actions.pending === "redeemSet" ? (
                    <LoaderCircle size={12} className="animate-spin" />
                  ) : null}{" "}
                  Redeem set
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                disabled={raw === 0n || actions.pending !== null}
                onClick={() => actions.run("redeem", raw)}
              >
                {actions.pending === "redeem" ? <LoaderCircle size={12} className="animate-spin" /> : null}{" "}
                Redeem {row.outcome === 1 ? "KEPT" : "BROKEN"}
              </Button>
            )}
            {actions.message ? (
              <p
                className={cn("flex items-center gap-2", actions.message.ok ? "text-good" : "text-critical")}
              >
                {actions.message.text}
                {actions.message.hash ? <TxLink hash={actions.message.hash} /> : null}
              </p>
            ) : null}
            <p className="text-ink-4">Sell either side on a Kuru KEPT or BROKEN market to take a view.</p>
          </>
        ) : (
          <p className="text-ink-3">Connect a wallet to mint or redeem.</p>
        )}
      </div>
    </div>
  );
}

function Balance({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-sm border border-line px-2 py-1.5">
      <span className="text-2xs text-ink-3">{label}</span>
      <span className="num text-ink">{value}</span>
    </div>
  );
}

export default function OutcomesPage() {
  const outcomes = useOutcomes();
  const engagements = useEngagements();
  const markets = useMarkets((engagements.data ?? []).map((e) => e.market));
  const [selected, setSelected] = useQueryState("m", parseAsString);

  const rows = useMemo<Row[]>(() => {
    const byId = new Map((engagements.data ?? []).map((e) => [e.id, e]));
    return (outcomes.data ?? []).map((o) => {
      const engagement = byId.get(o.engagementId);
      return {
        ...o,
        engagement,
        info: engagement ? markets.get(engagement.market.toLowerCase()) : undefined,
      };
    });
  }, [outcomes.data, engagements.data, markets]);
  const active = rows.find((r) => r.id === selected) ?? rows[0];

  return (
    <>
      <PageHeader
        title="Outcome markets"
        description="KEPT and BROKEN tokens on whether a market maker keeps its covenant. They price the promise, hedge it, and settle from the escrow ledger."
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-auto bg-line lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
        <Panel className="min-h-[280px] lg:min-h-0">
          {outcomes.error ? (
            <ErrorState error={outcomes.error} />
          ) : outcomes.isLoading ? (
            <Loading />
          ) : (
            <DataTable
              data={rows}
              columns={columns}
              getRowId={(r) => r.id}
              initialSort={[{ id: "id", desc: true }]}
              onRowClick={(r) => setSelected(r.id)}
              rowClassName={(r) => (r.id === active?.id ? "bg-active" : undefined)}
              empty={
                <Empty title="No outcome markets yet">
                  Anyone can open one for an active covenant’s upcoming epochs.
                </Empty>
              }
            />
          )}
        </Panel>
        <Panel>
          <PanelHeader
            title={active ? `Market #${active.id}` : "Market"}
            meta={active ? epochs(active) : undefined}
          />
          {active ? <Ticket key={active.id} row={active} /> : <Empty title="Select a market" />}
        </Panel>
      </div>
    </>
  );
}
