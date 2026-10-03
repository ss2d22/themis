"use client";

import { ChevronRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { Address, TxLink } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ComplianceBadge, StatusBadge } from "@/components/ui/status";
import { Tooltip } from "@/components/ui/tooltip";
import type { MarketInfo } from "@/lib/chain";
import { type LiveCovenant, useCovenantActions } from "@/lib/covenant";
import { blocksToDuration } from "@/lib/format";
import { type Engagement, templateLabel } from "@/lib/types";
import { AcceptDialog } from "./accept-dialog";

const actionLabel = {
  poke: "Record book",
  closeEpoch: "Close epoch",
  clawback: "Claw back",
  terminate: "Terminate",
  releaseBackstop: "Release backstop",
  claimRetainer: "Claim retainer",
  settle: "Settle",
  cancel: "Withdraw proposal",
} as const;

export function TerminalHeader({
  e,
  live,
  market,
  head,
}: {
  e: Engagement;
  live: LiveCovenant | undefined;
  market: MarketInfo;
  head: bigint;
}) {
  const id = BigInt(e.id);
  const actions = useCovenantActions(id);
  const start = e.startBlock ? BigInt(e.startBlock) : 0n;
  const end = e.endBlock ? BigInt(e.endBlock) : 0n;
  const elapsed = end > start ? Math.min(1, Number(head - start) / Number(end - start)) : 0;
  const left = end > head ? end - head : 0n;
  const me = actions.address?.toLowerCase();
  const isIssuer = me === e.issuer.toLowerCase();
  const isMaker = me === e.maker.toLowerCase();
  const eng = live?.engagement;
  const epochEnd = eng ? start + BigInt(e.terms.ob.epochBlocks) * BigInt(eng.nextEpoch + 1) : 0n;

  const available: { action: keyof typeof actionLabel; hint: string; tone?: "primary" | "danger" }[] = [];
  if (e.status === 2) {
    available.push({
      action: "poke",
      hint: "Records the book now. Pays a bounty if it reports a breach past grace.",
    });
    if (
      eng &&
      head >= (epochEnd < end ? epochEnd : end) &&
      start + BigInt(e.terms.ob.epochBlocks) * BigInt(eng.nextEpoch) < end
    )
      available.push({
        action: "closeEpoch",
        hint: `Closes epoch ${eng.nextEpoch} and checks it against the uptime target.`,
      });
    if (head >= end)
      available.push({ action: "settle", hint: "Settles the matured agreement.", tone: "primary" });
    if (isIssuer)
      available.push({ action: "terminate", hint: "Ends the agreement after the notice period." });
    if (isMaker) available.push({ action: "claimRetainer", hint: "Withdraws the retainer earned so far." });
  }
  if (e.status === 3)
    available.push({
      action: "clawback",
      hint: "Claws the loan back into passive liquidity. Pays the clawback bounty.",
      tone: "danger",
    });
  if (e.status === 5 && isIssuer && e.backstopPosition)
    available.push({ action: "releaseBackstop", hint: "Withdraws the backstop after its lock." });

  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line bg-panel px-3 py-2">
      <nav className="flex items-center gap-1 text-xs text-ink-3" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink-2">
          Covenants
        </Link>
        <ChevronRight size={12} aria-hidden />
      </nav>
      <div className="flex items-baseline gap-2">
        <h1 className="text-base font-semibold text-ink">
          {market.baseSymbol}/{market.quoteSymbol}
        </h1>
        <span className="num text-xs text-ink-3">#{e.id}</span>
        <span className="rounded-xs border border-line-strong px-1.5 text-2xs font-medium text-ink-2">
          {templateLabel[e.terms.template ?? 0]}
        </span>
      </div>
      <StatusBadge status={e.status} />
      {e.status === 2 && live ? (
        <ComplianceBadge compliant={live.metrics.compliant} suspended={live.metrics.suspended} />
      ) : null}
      <div className="flex items-center gap-1.5 text-xs text-ink-3">
        {(e.terms.template ?? 0) === 0 ? "maker" : "operator"} <Address address={e.maker} />
      </div>
      {e.status === 2 ? (
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <span className="relative h-1 w-24 rounded-full bg-hover" aria-hidden>
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-ink-3"
              style={{ width: `${elapsed * 100}%` }}
            />
          </span>
          <span className="num">{left > 0n ? `${blocksToDuration(left)} left` : "matured"}</span>
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5">
        {actions.result ? (
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs",
              actions.result.ok ? "text-good" : "text-critical",
            )}
          >
            {actionLabel[actions.result.action]}{" "}
            {actions.result.ok ? "confirmed" : `failed: ${actions.result.message}`}
            {actions.result.hash ? <TxLink hash={actions.result.hash} /> : null}
          </span>
        ) : null}
        {e.status === 1 && isMaker ? <AcceptDialog e={e} market={market} /> : null}
        {e.status === 1 && !isMaker ? (
          <span className="text-xs text-ink-3">Waiting for the market maker to accept</span>
        ) : null}
        {available.map(({ action, hint, tone }) => (
          <Tooltip
            key={action}
            content={actions.connected ? hint : `${hint} Connect a wallet to act.`}
            side="bottom"
          >
            <span>
              <Button
                size="sm"
                variant={tone ?? "default"}
                disabled={!actions.connected || actions.pending !== null}
                onClick={() => actions.run(action)}
              >
                {actions.pending === action ? <LoaderCircle size={12} className="animate-spin" /> : null}
                {actionLabel[action]}
              </Button>
            </span>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
