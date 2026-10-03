import type { Engagement } from "./types";

/** Live spread in bps of the reference price, from the last observation. */
export function spreadBps(e: Pick<Engagement, "bestBid" | "bestAsk" | "refPrice">): number | null {
  if (!e.bestBid || !e.bestAsk || !e.refPrice) return null;
  const bid = Number(e.bestBid);
  const ask = Number(e.bestAsk);
  const ref = Number(e.refPrice);
  if (bid === 0 || ask === 0 || ref === 0) return null;
  return ((ask - bid) / ref) * 10_000;
}

export function vestedFraction(e: Engagement): number {
  return Number(e.creditedBlocks) / e.terms.termBlocks;
}

export function blocksLeft(e: Engagement, head: bigint): bigint | null {
  if (!e.endBlock) return null;
  const end = BigInt(e.endBlock);
  return end > head ? end - head : 0n;
}
