"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useMemo, useState } from "react";
import { blocksToDuration } from "@/lib/format";
import type { Epoch, Observation } from "@/lib/types";

const COLUMNS = 30;
const MAX_ROWS = 6;

interface Props {
  startBlock: bigint;
  endBlock: bigint;
  head: bigint;
  epochBlocks: number;
  targetBps: number;
  observations: Observation[];
  epochs: Epoch[];
}

interface Cell {
  epoch: number;
  column: number;
  from: bigint;
  to: bigint;
  credited: number;
  length: number;
  future: boolean;
  pending: boolean;
}

/**
 * Uptime by slice of each epoch. Colour diverges around the agreed target: neutral at the target, blue above it,
 * red below it. Slices past the last observation are pending, because the ledger only credits an interval once
 * it is observed at both ends; slices not yet reached stay empty.
 */
export function ComplianceHeatmap({
  startBlock,
  endBlock,
  head,
  epochBlocks,
  targetBps,
  observations,
  epochs,
}: Props) {
  const [hover, setHover] = useState<Cell | null>(null);
  const target = targetBps / 10_000;
  const bucket = BigInt(Math.max(1, Math.floor(epochBlocks / COLUMNS)));
  const span = BigInt(epochBlocks);
  const now = head < endBlock ? head : endBlock;
  const currentEpoch = Number((now - startBlock) / span);
  const totalEpochs = Math.ceil(Number(endBlock - startBlock) / epochBlocks);
  const firstEpoch = Math.max(0, currentEpoch - MAX_ROWS + 1);

  const rows = useMemo(() => {
    const credit = new Map<string, number>();
    const sorted = [...observations].sort((a, b) => (BigInt(a.block) < BigInt(b.block) ? -1 : 1));
    let prev = startBlock;
    for (const o of sorted) {
      let from = prev;
      let remaining = BigInt(o.credited);
      while (remaining > 0n) {
        const index = (from - startBlock) / bucket;
        const bucketEnd = startBlock + (index + 1n) * bucket;
        const take = bucketEnd - from < remaining ? bucketEnd - from : remaining;
        credit.set(index.toString(), (credit.get(index.toString()) ?? 0) + Number(take));
        from += take;
        remaining -= take;
      }
      prev = BigInt(o.block);
    }

    const observedTo = sorted.length ? BigInt(sorted[sorted.length - 1]?.block ?? 0) : startBlock;
    const out: Cell[][] = [];
    for (let e = firstEpoch; e <= Math.min(currentEpoch, totalEpochs - 1); e++) {
      const row: Cell[] = [];
      const epochStart = startBlock + BigInt(e) * span;
      for (let col = 0; col < COLUMNS; col++) {
        const from = epochStart + BigInt(col) * bucket;
        const to = col === COLUMNS - 1 ? epochStart + span : from + bucket;
        const index = (from - startBlock) / bucket;
        const limit = now < observedTo ? now : observedTo;
        const reached = to <= limit ? to : limit;
        row.push({
          epoch: e,
          column: col,
          from,
          to,
          credited: credit.get(index.toString()) ?? 0,
          length: reached > from ? Number(reached - from) : 0,
          future: from >= now,
          pending: from < now && from >= observedTo,
        });
      }
      out.push(row);
    }
    return out;
  }, [observations, startBlock, bucket, span, firstEpoch, currentEpoch, totalEpochs, now]);

  const byEpoch = new Map(epochs.map((e) => [e.epoch, e]));

  const fill = (cell: Cell) => {
    if (cell.future || cell.pending || cell.length === 0) return undefined;
    const u = Math.min(1, cell.credited / cell.length);
    if (u >= target) {
      const w = target >= 1 ? 1 : (u - target) / (1 - target);
      return `color-mix(in oklab, var(--accent) ${Math.round(10 + w * 45)}%, var(--diverge-mid))`;
    }
    const w = (target - u) / target;
    return `color-mix(in oklab, var(--critical) ${Math.round(40 + w * 60)}%, var(--diverge-mid))`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-3 py-2">
      <div className="flex h-4 shrink-0 items-center gap-3 text-xs">
        <span className="font-medium text-ink">Uptime by epoch</span>
        <span className="num text-ink-3">
          {hover
            ? `Epoch ${hover.epoch} · blocks ${hover.from.toLocaleString("en-US")}–${hover.to.toLocaleString("en-US")} · ${
                hover.pending
                  ? "awaiting the next observation"
                  : hover.length
                    ? `${Math.round((Math.min(hover.credited, hover.length) / hover.length) * 100)}% in compliance`
                    : "not reached"
              }`
            : `${COLUMNS} slices of ${blocksToDuration(epochBlocks)} per row`}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-2xs text-ink-3">
          0%
          <span
            className="h-1.5 w-28 rounded-full"
            style={{
              background: `linear-gradient(90deg, var(--critical), var(--diverge-mid) ${targetBps / 100}%, color-mix(in oklab, var(--accent) 55%, var(--diverge-mid)))`,
            }}
            aria-hidden
          />
          100%
          <span className="text-ink-4">· target {targetBps / 100}%</span>
        </span>
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col justify-end gap-[2px]"
        onPointerLeave={() => setHover(null)}
      >
        {rows.map((row) => {
          const epoch = row[0]?.epoch ?? 0;
          const closed = byEpoch.get(epoch);
          return (
            <div key={epoch} className="flex items-center gap-2">
              <span className="num w-8 shrink-0 text-right text-2xs text-ink-4">E{epoch}</span>
              <div
                className="grid flex-1 gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
              >
                {row.map((cell) => (
                  <div
                    key={cell.column}
                    onPointerEnter={() => setHover(cell)}
                    className="h-3 rounded-[2px] outline-ink hover:outline"
                    style={{
                      background: fill(cell) ?? (cell.pending ? "var(--hover)" : "transparent"),
                      boxShadow: fill(cell) ? undefined : "inset 0 0 0 1px var(--line)",
                    }}
                  />
                ))}
              </div>
              <span className="flex w-20 shrink-0 items-center justify-end gap-1 text-2xs">
                {closed ? (
                  closed.passed ? (
                    <>
                      <CircleCheck size={11} className="text-good" aria-hidden />
                      <span className="num text-ink-2">
                        {((closed.credited / closed.length) * 100).toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <CircleX size={11} className="text-critical" aria-hidden />
                      <span className="num text-critical">
                        {((closed.credited / closed.length) * 100).toFixed(1)}%
                      </span>
                    </>
                  )
                ) : (
                  <span className="text-ink-4">{epoch === currentEpoch ? "live" : "open"}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
