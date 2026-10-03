import { encodeCancel, encodeQuote, type Quote } from "@covenant/sdk";
import type { Hex } from "viem";
import type { LiveSlot } from "../covenant.js";

export interface LadderConfig {
  levels: number;
  firstOffsetBps: number;
  stepBps: number;
  sizePerLevel: bigint;
}

export const BID_SLOT_BASE = 0;
export const ASK_SLOT_BASE = 32;

function roundDown(price: bigint, tick: bigint) {
  return (price / tick) * tick;
}

function roundUp(price: bigint, tick: bigint) {
  return ((price + tick - 1n) / tick) * tick;
}

/** Symmetric ladder around `mid`. Bids take slots from 0, asks from 32. */
export function buildLadder(mid: bigint, cfg: LadderConfig, tick: bigint): Quote[] {
  const quotes: Quote[] = [];
  for (let i = 0; i < cfg.levels; i++) {
    const offset = BigInt(cfg.firstOffsetBps + i * cfg.stepBps);
    const bid = roundDown((mid * (10_000n - offset)) / 10_000n, tick);
    const ask = roundUp((mid * (10_000n + offset)) / 10_000n, tick);
    quotes.push({ slot: BID_SLOT_BASE + i, side: "buy", price: bid, size: cfg.sizePerLevel });
    quotes.push({ slot: ASK_SLOT_BASE + i, side: "sell", price: ask, size: cfg.sizePerLevel });
  }
  return quotes;
}

/** Shrinks ask sizes, deepest level first, so total ask size fits within `maxAskSize`. */
export function capAsks(quotes: Quote[], maxAskSize: bigint): Quote[] {
  let total = quotes.filter((q) => q.side === "sell").reduce((sum, q) => sum + q.size, 0n);
  if (total <= maxAskSize) return quotes;
  const asks = quotes.filter((q) => q.side === "sell").sort((a, b) => (a.price > b.price ? -1 : 1));
  const trimmed = new Map<number, bigint>();
  for (const ask of asks) {
    if (total <= maxAskSize) break;
    const cut = ask.size < total - maxAskSize ? ask.size : total - maxAskSize;
    trimmed.set(ask.slot, ask.size - cut);
    total -= cut;
  }
  return quotes
    .map((q) => (trimmed.has(q.slot) ? { ...q, size: trimmed.get(q.slot) ?? 0n } : q))
    .filter((q) => q.size > 0n);
}

/** Keeps quotes inside the escrow's price band so the whole batch is not rejected. */
export function withinBand(quotes: Quote[], refPrice: bigint, bandBps: number): Quote[] {
  const band = (refPrice * BigInt(bandBps)) / 10_000n;
  return quotes.filter((q) => q.price >= refPrice - band && q.price <= refPrice + band);
}

export interface RequotePlan {
  ops: Hex[];
  placed: number;
  cancelled: number;
}

/**
 * Operations that move the live book to `desired`. Quotes within `toleranceBps` of their target are left
 * alone to keep queue priority unless their side is in `refresh`, which re-places them at full size after
 * partial fills. Slots younger than the minimum quote life are never touched.
 */
export function planRequote(
  desired: Quote[],
  live: LiveSlot[],
  block: bigint,
  minQuoteLife: bigint,
  toleranceBps: number,
  refresh: ReadonlySet<Quote["side"]> = new Set(),
): RequotePlan {
  const bySlot = new Map(live.map((s) => [s.slot, s]));
  const wanted = new Set(desired.map((q) => q.slot));
  const ops: Hex[] = [];
  let placed = 0;
  let cancelled = 0;

  for (const quote of desired) {
    const current = bySlot.get(quote.slot);
    if (current) {
      if (block < current.placedBlock + minQuoteLife) continue;
      const drift = current.price > quote.price ? current.price - quote.price : quote.price - current.price;
      const sameSide = current.isBuy === (quote.side === "buy");
      const onTarget =
        sameSide && current.size === quote.size && drift * 10_000n <= quote.price * BigInt(toleranceBps);
      if (onTarget && !refresh.has(quote.side)) continue;
    }
    ops.push(encodeQuote(quote));
    placed++;
  }

  for (const slot of live) {
    if (wanted.has(slot.slot) || block < slot.placedBlock + minQuoteLife) continue;
    ops.push(encodeCancel(slot.slot));
    cancelled++;
  }
  return { ops, placed, cancelled };
}
