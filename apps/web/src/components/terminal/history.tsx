"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useMemo } from "react";
import { Address, TxLink } from "@/components/ui/address";
import { type Column, DataTable } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarketInfo } from "@/lib/chain";
import { blocksToDuration, clock, units } from "@/lib/format";
import type { Report } from "@/lib/types";
import { Settlement } from "./settlement";

type Fill = Report["fills"][number];
type Obs = Report["observations"][number];
type Ep = Report["epochs"][number];
type Change = Report["changes"][number];
type Bounty = Report["bounties"][number];
type Quote = Report["quotes"][number];

const right = { align: "right" } as const;
const tx = <T extends { tx: string }>(): Column<T> => ({
  id: "tx",
  header: "Transaction",
  accessorFn: (r) => r.tx,
  size: 130,
  meta: { grow: true },
  enableSorting: false,
  cell: (c) => <TxLink hash={c.row.original.tx} />,
});

export function History({ report, market }: { report: Report; market: MarketInfo }) {
  const columns = useMemo(() => {
    const price = (raw: string | number) =>
      (Number(raw) / Number(market.pricePrecision)).toLocaleString("en-US", { minimumFractionDigits: 2 });
    const size = (raw: string | bigint) => (Number(raw) / Number(market.sizePrecision)).toFixed(4);
    const quote = (raw: string | bigint) => units(raw, market.quoteDecimals);

    const fills: Column<Fill>[] = [
      {
        id: "time",
        header: "Time",
        accessorFn: (r) => Number(r.timestamp),
        size: 90,
        cell: (c) => <span className="num">{clock(c.row.original.timestamp)}</span>,
      },
      {
        id: "side",
        header: "Maker",
        accessorFn: (r) => r.makerIsBuy,
        size: 90,
        cell: (c) =>
          c.row.original.makerIsBuy ? (
            <span className="text-bid">Bought</span>
          ) : (
            <span className="text-ask">Sold</span>
          ),
      },
      {
        id: "price",
        header: `Price ${market.quoteSymbol}`,
        accessorFn: (r) => Number(r.price),
        size: 120,
        meta: right,
        cell: (c) => price(c.row.original.price),
      },
      {
        id: "size",
        header: `Size ${market.baseSymbol}`,
        accessorFn: (r) => Number(r.size),
        size: 110,
        meta: right,
        cell: (c) => size(c.row.original.size),
      },
      {
        id: "notional",
        header: `Notional ${market.quoteSymbol}`,
        accessorFn: (r) =>
          (Number(r.size) / Number(market.sizePrecision)) * (Number(r.price) / Number(market.pricePrecision)),
        size: 130,
        meta: right,
        cell: (c) =>
          c
            .getValue<number>()
            .toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }),
      },
      {
        id: "left",
        header: "Left in order",
        accessorFn: (r) => Number(r.remaining),
        size: 110,
        meta: right,
        cell: (c) => size(c.row.original.remaining),
      },
      { id: "slot", header: "Slot", accessorFn: (r) => r.slot, size: 60, meta: right },
      { id: "taker", header: "Taker account", accessorFn: (r) => r.takerAccount, size: 110, meta: right },
      tx<Fill>(),
    ];
    const observations: Column<Obs>[] = [
      {
        id: "block",
        header: "Block",
        accessorFn: (r) => Number(r.block),
        size: 110,
        meta: right,
        cell: (c) => Number(c.row.original.block).toLocaleString("en-US"),
      },
      {
        id: "time",
        header: "Time",
        accessorFn: (r) => Number(r.timestamp),
        size: 90,
        cell: (c) => <span className="num">{clock(c.row.original.timestamp)}</span>,
      },
      {
        id: "state",
        header: "Book",
        accessorFn: (r) => r.compliant,
        size: 120,
        cell: (c) =>
          c.row.original.compliant ? (
            <span className="flex items-center gap-1 text-good">
              <CircleCheck size={12} /> Compliant
            </span>
          ) : (
            <span className="flex items-center gap-1 text-critical">
              <CircleX size={12} /> Breach
            </span>
          ),
      },
      {
        id: "credited",
        header: "Credited",
        accessorFn: (r) => Number(r.credited),
        size: 90,
        meta: right,
        cell: (c) => `${c.row.original.credited} blk`,
      },
      {
        id: "ref",
        header: "Reference",
        accessorFn: (r) => Number(r.refPrice),
        size: 110,
        meta: right,
        cell: (c) => price(c.row.original.refPrice),
      },
      {
        id: "bid",
        header: "Best bid",
        accessorFn: (r) => Number(r.bestBid),
        size: 110,
        meta: right,
        cell: (c) => (c.row.original.bestBid === "0" ? "—" : price(c.row.original.bestBid)),
      },
      {
        id: "ask",
        header: "Best ask",
        accessorFn: (r) => Number(r.bestAsk),
        size: 110,
        meta: right,
        cell: (c) => (c.row.original.bestAsk === "0" ? "—" : price(c.row.original.bestAsk)),
      },
      {
        id: "bidDepth",
        header: "Bid depth",
        accessorFn: (r) => Number(r.bidDepth),
        size: 110,
        meta: right,
        cell: (c) => quote(c.row.original.bidDepth),
      },
      {
        id: "askDepth",
        header: "Ask depth",
        accessorFn: (r) => Number(r.askDepth),
        size: 110,
        meta: { align: "right", grow: true },
        cell: (c) => quote(c.row.original.askDepth),
      },
    ];
    const epochs: Column<Ep>[] = [
      { id: "epoch", header: "Epoch", accessorFn: (r) => r.epoch, size: 70, meta: right },
      {
        id: "result",
        header: "Result",
        accessorFn: (r) => r.passed,
        size: 100,
        cell: (c) =>
          c.row.original.passed ? (
            <span className="flex items-center gap-1 text-good">
              <CircleCheck size={12} /> Passed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-critical">
              <CircleX size={12} /> Failed
            </span>
          ),
      },
      {
        id: "uptime",
        header: "Uptime",
        accessorFn: (r) => r.credited / r.length,
        size: 90,
        meta: right,
        cell: (c) => `${(c.getValue<number>() * 100).toFixed(1)}%`,
      },
      {
        id: "credited",
        header: "Credited / length",
        accessorFn: (r) => r.credited,
        size: 140,
        meta: right,
        cell: (c) => `${c.row.original.credited} / ${c.row.original.length}`,
      },
      { id: "streak", header: "Streak", accessorFn: (r) => r.streak, size: 80, meta: right },
      {
        id: "by",
        header: "Closed by",
        accessorFn: (r) => r.closedBy,
        size: 140,
        cell: (c) => <Address address={c.row.original.closedBy} />,
      },
      tx<Ep>(),
    ];
    const changes: Column<Change>[] = [
      {
        id: "block",
        header: "Block",
        accessorFn: (r) => Number(r.block),
        size: 110,
        meta: right,
        cell: (c) => Number(c.row.original.block).toLocaleString("en-US"),
      },
      {
        id: "time",
        header: "Time",
        accessorFn: (r) => Number(r.timestamp),
        size: 90,
        cell: (c) => <span className="num">{clock(c.row.original.timestamp)}</span>,
      },
      {
        id: "state",
        header: "Became",
        accessorFn: (r) => r.compliant,
        size: 130,
        cell: (c) =>
          c.row.original.compliant ? (
            <span className="flex items-center gap-1 text-good">
              <CircleCheck size={12} /> Compliant
            </span>
          ) : (
            <span className="flex items-center gap-1 text-critical">
              <CircleX size={12} /> In breach
            </span>
          ),
      },
      tx<Change>(),
    ];
    const bounties: Column<Bounty>[] = [
      {
        id: "block",
        header: "Block",
        accessorFn: (r) => Number(r.block),
        size: 110,
        meta: right,
        cell: (c) => Number(c.row.original.block).toLocaleString("en-US"),
      },
      {
        id: "watcher",
        header: "Watchtower",
        accessorFn: (r) => r.watcher,
        size: 150,
        cell: (c) => <Address address={c.row.original.watcher} />,
      },
      {
        id: "amount",
        header: `Paid ${market.quoteSymbol}`,
        accessorFn: (r) => Number(r.amount),
        size: 110,
        meta: right,
        cell: (c) => quote(c.row.original.amount),
      },
      tx<Bounty>(),
    ];
    const quotes: Column<Quote>[] = [
      {
        id: "block",
        header: "Block",
        accessorFn: (r) => Number(r.block),
        size: 110,
        meta: right,
        cell: (c) => Number(c.row.original.block).toLocaleString("en-US"),
      },
      {
        id: "time",
        header: "Time",
        accessorFn: (r) => Number(r.timestamp),
        size: 90,
        cell: (c) => <span className="num">{clock(c.row.original.timestamp)}</span>,
      },
      { id: "ops", header: "Orders changed", accessorFn: (r) => r.ops, size: 120, meta: right },
      tx<Quote>(),
    ];
    return { fills, observations, epochs, changes, bounties, quotes };
  }, [market]);

  const e = report.engagement;
  const desc = (id: string) => [{ id, desc: true }];
  const closed = e.status >= 4 && e.settlement;

  return (
    <Tabs defaultValue={closed ? "settlement" : "fills"} className="flex min-h-0 flex-1 flex-col">
      <TabsList end={<span className="text-2xs text-ink-3">Every row links to its transaction</span>}>
        {closed ? <TabsTrigger value="settlement">Settlement</TabsTrigger> : null}
        <TabsTrigger value="fills" count={report.fills.length}>
          Fills
        </TabsTrigger>
        <TabsTrigger value="epochs" count={report.epochs.length}>
          Epochs
        </TabsTrigger>
        <TabsTrigger value="changes" count={report.changes.length}>
          Compliance changes
        </TabsTrigger>
        <TabsTrigger value="observations" count={report.observations.length}>
          Observations
        </TabsTrigger>
        <TabsTrigger value="bounties" count={report.bounties.length}>
          Bounties
        </TabsTrigger>
        <TabsTrigger value="quotes" count={report.quotes.length}>
          Quote updates
        </TabsTrigger>
      </TabsList>
      {closed ? (
        <TabsContent value="settlement" className="overflow-auto">
          <Settlement e={e} market={market} />
        </TabsContent>
      ) : null}
      <TabsContent value="fills" className="flex">
        <DataTable
          data={report.fills}
          columns={columns.fills}
          getRowId={(r) => r.id}
          initialSort={desc("time")}
          empty={<Empty title="No fills yet">Taker trades against covenant quotes appear here.</Empty>}
        />
      </TabsContent>
      <TabsContent value="epochs" className="flex">
        <DataTable
          data={report.epochs}
          columns={columns.epochs}
          getRowId={(r) => String(r.epoch)}
          initialSort={desc("epoch")}
          empty={
            <Empty title="No epochs closed yet">
              An epoch closes {blocksToDuration(e.terms.ob.epochBlocks)} after it opens.
            </Empty>
          }
        />
      </TabsContent>
      <TabsContent value="changes" className="flex">
        <DataTable
          data={report.changes}
          columns={columns.changes}
          getRowId={(r) => r.id}
          initialSort={desc("block")}
          empty={<Empty title="Compliance has not changed" />}
        />
      </TabsContent>
      <TabsContent value="observations" className="flex">
        <DataTable
          data={report.observations}
          columns={columns.observations}
          getRowId={(r) => r.id}
          initialSort={desc("block")}
          empty={<Empty title="No observations yet" />}
        />
      </TabsContent>
      <TabsContent value="bounties" className="flex">
        <DataTable
          data={report.bounties}
          columns={columns.bounties}
          getRowId={(r) => r.id}
          initialSort={desc("block")}
          empty={
            <Empty title="No bounties paid">Watchtowers are paid from the bond for reporting breaches.</Empty>
          }
        />
      </TabsContent>
      <TabsContent value="quotes" className="flex">
        <DataTable
          data={report.quotes}
          columns={columns.quotes}
          getRowId={(r) => r.id}
          initialSort={desc("block")}
          empty={<Empty title="No quotes yet" />}
        />
      </TabsContent>
    </Tabs>
  );
}
