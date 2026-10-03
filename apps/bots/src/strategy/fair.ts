import type { LiveSlot } from "../covenant.js";

export interface L2Book {
  bidPrices: readonly number[];
  bidSizes: readonly bigint[];
  askPrices: readonly number[];
  askSizes: readonly bigint[];
}

function bestExcluding(prices: readonly number[], sizes: readonly bigint[], own: Map<bigint, bigint>) {
  for (let i = 0; i < prices.length; i++) {
    const price = BigInt(prices[i] ?? 0);
    const size = sizes[i] ?? 0n;
    if (size > (own.get(price) ?? 0n)) return price;
  }
  return undefined;
}

/** Mid of the book with the escrow's own quotes removed, so the market maker does not chase itself. */
export function externalMid(book: L2Book, own: LiveSlot[]): bigint | undefined {
  const ownBids = new Map<bigint, bigint>();
  const ownAsks = new Map<bigint, bigint>();
  for (const s of own) {
    const side = s.isBuy ? ownBids : ownAsks;
    side.set(s.price, (side.get(s.price) ?? 0n) + s.size);
  }
  const bid = bestExcluding(book.bidPrices, book.bidSizes, ownBids);
  const ask = bestExcluding(book.askPrices, book.askSizes, ownAsks);
  if (bid === undefined || ask === undefined || ask <= bid) return undefined;
  return (bid + ask) / 2n;
}
