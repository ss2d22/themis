"use client";

import { TargetMeter } from "@/components/covenants/meter";
import { GRADES, GradeBadge } from "@/components/makers/grade";
import { Address } from "@/components/ui/address";
import { cn } from "@/components/ui/cn";
import { type Column, DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, ErrorState, Loading } from "@/components/ui/states";
import { useMakers } from "@/lib/api";
import { blocksToDuration, percentFromBps } from "@/lib/format";
import type { MakerRow } from "@/lib/types";

const columns: Column<MakerRow>[] = [
  {
    id: "rank",
    header: "#",
    accessorFn: (_, i) => i + 1,
    size: 48,
    enableSorting: false,
    cell: (c) => <span className="num text-ink-3">{c.row.index + 1}</span>,
  },
  {
    id: "maker",
    header: "Market maker",
    accessorFn: (r) => r.maker,
    size: 160,
    cell: (c) => <Address address={c.row.original.maker} />,
  },
  {
    id: "grade",
    header: "Grade",
    accessorFn: (r) => r.uptimeBps - r.clawbacks * 10_000 - r.defaults * 100_000,
    size: 80,
    cell: (c) => <GradeBadge grade={c.row.original.grade} />,
  },
  {
    id: "uptime",
    header: "Verified uptime",
    accessorFn: (r) => r.uptimeBps,
    size: 170,
    meta: { align: "right" },
    cell: (c) => (
      <TargetMeter
        value={c.row.original.uptimeBps}
        target={9_000}
        max={10_000}
        label={percentFromBps(c.row.original.uptimeBps, 2)}
        width={80}
      />
    ),
  },
  {
    id: "time",
    header: "Quoting time measured",
    accessorFn: (r) => Number(r.elapsed),
    size: 170,
    meta: { align: "right" },
    cell: (c) => blocksToDuration(c.row.original.elapsed),
  },
  {
    id: "engagements",
    header: "Covenants",
    accessorFn: (r) => r.engagements,
    size: 100,
    meta: { align: "right" },
  },
  {
    id: "failed",
    header: "Failed epochs",
    accessorFn: (r) => r.failedEpochs,
    size: 110,
    meta: { align: "right" },
    cell: (c) => (
      <span className={cn(c.row.original.failedEpochs > 0 && "text-critical")}>
        {c.row.original.failedEpochs}
      </span>
    ),
  },
  {
    id: "clawbacks",
    header: "Clawbacks",
    accessorFn: (r) => r.clawbacks,
    size: 100,
    meta: { align: "right" },
    cell: (c) => (
      <span className={cn(c.row.original.clawbacks > 0 && "text-critical")}>{c.row.original.clawbacks}</span>
    ),
  },
  {
    id: "defaults",
    header: "Defaults",
    accessorFn: (r) => r.defaults,
    size: 90,
    meta: { align: "right" },
    cell: (c) => (
      <span className={cn(c.row.original.defaults > 0 && "text-critical")}>{c.row.original.defaults}</span>
    ),
  },
  {
    id: "source",
    header: "Source",
    accessorFn: () => "chain",
    size: 140,
    meta: { grow: true },
    enableSorting: false,
    cell: () => <span className="text-ink-3">On chain</span>,
  },
];

export default function MakersPage() {
  const makers = useMakers();
  return (
    <>
      <PageHeader
        title="Maker ratings"
        description="Every grade comes from uptime the escrow measured against the Kuru book, not from data the market maker chose to share."
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_260px] gap-px bg-line">
        <section className="flex min-h-0 flex-col bg-panel">
          {makers.error ? (
            <ErrorState error={makers.error} />
          ) : makers.isLoading ? (
            <Loading />
          ) : (
            <DataTable
              data={makers.data ?? []}
              columns={columns}
              getRowId={(r) => r.maker}
              initialSort={[{ id: "grade", desc: true }]}
              empty={
                <Empty title="No rated market makers yet">
                  A maker is rated once one of its covenants starts quoting.
                </Empty>
              }
            />
          )}
        </section>
        <aside className="flex flex-col gap-3 bg-panel p-3 text-xs">
          <h2 className="label">Scale</h2>
          <dl className="flex flex-col gap-1.5">
            {GRADES.map(([grade, rule]) => (
              <div key={grade} className="flex items-center gap-2">
                <GradeBadge grade={grade} />
                <dd className="text-ink-3">{rule}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line pt-3 text-ink-3">
            Each clawback lowers a maker one notch. Uptime is the share of blocks a maker’s book met every
            covenant target at once, across all its covenants.
          </p>
          <a
            href={`${process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:42069"}/makers`}
            className="text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Download as JSON
          </a>
        </aside>
      </div>
    </>
  );
}
