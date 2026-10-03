"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Address } from "@/components/ui/address";
import { type Column, DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Empty, ErrorState, Loading } from "@/components/ui/states";
import { useEngagements, useWatchers } from "@/lib/api";
import { useHead } from "@/lib/chain";
import { units } from "@/lib/format";
import type { Engagement, WatcherRow } from "@/lib/types";

const columns: Column<WatcherRow>[] = [
  {
    id: "rank",
    header: "#",
    accessorFn: (_, i) => i,
    size: 48,
    enableSorting: false,
    cell: (c) => <span className="num text-ink-3">{c.row.index + 1}</span>,
  },
  {
    id: "address",
    header: "Watchtower",
    accessorFn: (r) => r.address,
    size: 180,
    cell: (c) => <Address address={c.row.original.address} />,
  },
  { id: "bounties", header: "Bounties", accessorFn: (r) => r.bounties, size: 100, meta: { align: "right" } },
  {
    id: "earned",
    header: "Earned USDC",
    accessorFn: (r) => Number(r.earned),
    size: 140,
    meta: { align: "right", grow: true },
    cell: (c) => units(c.row.original.earned, 6),
  },
];

interface Opportunity {
  id: string;
  kind: string;
  detail: string;
}

function opportunities(engagements: Engagement[], head: bigint): Opportunity[] {
  const out: Opportunity[] = [];
  for (const e of engagements) {
    if (e.status === 3)
      out.push({ id: e.id, kind: "Claw back", detail: `pays ${units(e.terms.risk.clawbackBounty, 6)} USDC` });
    if (e.status !== 2) continue;
    if (!e.compliant)
      out.push({ id: e.id, kind: "Report breach", detail: `after ${e.terms.ob.graceBlocks} block grace` });
    if (e.endBlock && head >= BigInt(e.endBlock) + BigInt(e.terms.exerciseWindowBlocks))
      out.push({ id: e.id, kind: "Settle", detail: "matured" });
  }
  return out;
}

export default function WatchtowersPage() {
  const watchers = useWatchers();
  const engagements = useEngagements();
  const head = useHead().data?.block ?? 0n;
  const open = useMemo(() => opportunities(engagements.data ?? [], head), [engagements.data, head]);

  return (
    <>
      <PageHeader
        title="Watchtowers"
        description="Anyone can enforce a covenant. Reporting a breach, closing a failed epoch or clawing back pays a bounty from the market maker’s bond."
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-auto bg-line lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        <Panel className="min-h-[280px] lg:min-h-0">
          <PanelHeader title="Earnings" meta="bounties paid on chain" />
          {watchers.error ? (
            <ErrorState error={watchers.error} />
          ) : watchers.isLoading ? (
            <Loading />
          ) : (
            <DataTable
              data={watchers.data ?? []}
              columns={columns}
              getRowId={(r) => r.address}
              initialSort={[{ id: "earned", desc: true }]}
              empty={<Empty title="No bounties paid yet" />}
            />
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Open right now" meta={`${open.length} actionable`} />
          <div className="min-h-0 flex-1 overflow-auto">
            {open.length === 0 ? (
              <Empty title="Nothing to enforce">Every active covenant is in compliance.</Empty>
            ) : (
              open.map((o) => (
                <Link
                  key={`${o.id}-${o.kind}`}
                  href={`/c/${o.id}`}
                  className="flex h-9 items-center gap-3 border-b border-line px-3 text-xs hover:bg-hover"
                >
                  <span className="num text-ink">#{o.id}</span>
                  <span className="font-medium text-ink-2">{o.kind}</span>
                  <span className="ml-auto text-ink-3">{o.detail}</span>
                </Link>
              ))
            )}
          </div>
          <PanelHeader title="Run one" className="border-t" />
          <div className="flex flex-col gap-2 p-3 text-xs text-ink-3">
            <p>
              The reference watchtower polls every covenant, simulates each call, and only sends the ones that
              pay.
            </p>
            <pre className="num overflow-x-auto rounded-sm border border-line bg-bg p-2 text-2xs text-ink-2">
              {"cd apps/bots\nWATCHER_KEY=0x… pnpm start watchtower"}
            </pre>
          </div>
        </Panel>
      </div>
    </>
  );
}
