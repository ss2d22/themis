import type { Quote } from "@covenant/sdk";

/**
 * Shifts the quoting mid away from the side the maker is overloaded on. Long base against the loan lowers the
 * mid so asks fill first; short base raises it. The shift is linear in the deviation and capped.
 */
export function skewedMid(
  mid: bigint,
  base: bigint,
  neutral: bigint,
  bpsPerLoan: number,
  maxBps: number,
): bigint {
  if (neutral === 0n) return mid;
  const deviation = Number(base - neutral) / Number(neutral);
  const skew = Math.max(-maxBps, Math.min(maxBps, deviation * bpsPerLoan));
  return (mid * BigInt(Math.round(10_000 - skew) * 100)) / 1_000_000n;
}

/** Shrinks bids, deepest first, until their total quote cost fits within `budget` raw quote atoms. */
export function capBids(quotes: Quote[], budget: bigint, cost: (q: Quote) => bigint): Quote[] {
  const bids = quotes.filter((q) => q.side === "buy").sort((a, b) => (a.price < b.price ? -1 : 1));
  let total = bids.reduce((sum, q) => sum + cost(q), 0n);
  if (total <= budget) return quotes;
  const resized = new Map<number, bigint>();
  for (const bid of bids) {
    if (total <= budget) break;
    const full = cost(bid);
    const over = total - budget;
    if (over >= full) {
      resized.set(bid.slot, 0n);
      total -= full;
    } else {
      const keep = (bid.size * (full - over)) / full;
      resized.set(bid.slot, keep);
      total -= full - cost({ ...bid, size: keep });
    }
  }
  return quotes
    .map((q) => (resized.has(q.slot) ? { ...q, size: resized.get(q.slot) ?? 0n } : q))
    .filter((q) => q.size > 0n);
}
