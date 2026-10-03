import type { Quote } from "@covenant/sdk";
import { describe, expect, it } from "vitest";
import { capBids, skewedMid } from "../src/strategy/inventory.js";

describe("skewedMid", () => {
  it("leaves the mid alone at the neutral inventory", () => {
    expect(skewedMid(200_000n, 10n, 10n, 20, 15)).toBe(200_000n);
  });

  it("lowers the mid when long and caps the shift", () => {
    expect(skewedMid(200_000n, 15n, 10n, 20, 15)).toBe(199_800n);
    expect(skewedMid(200_000n, 100n, 10n, 20, 15)).toBe(199_700n);
  });

  it("raises the mid when short", () => {
    expect(skewedMid(200_000n, 5n, 10n, 20, 15)).toBe(200_200n);
  });
});

describe("capBids", () => {
  const quotes: Quote[] = [
    { slot: 0, side: "buy", price: 100n, size: 10n },
    { slot: 1, side: "buy", price: 90n, size: 10n },
    { slot: 32, side: "sell", price: 110n, size: 10n },
  ];
  const cost = (q: Quote) => q.price * q.size;

  it("keeps bids that fit", () => {
    expect(capBids(quotes, 10_000n, cost)).toEqual(quotes);
  });

  it("trims the deepest bid before touching the best one", () => {
    const capped = capBids(quotes, 1_450n, cost);
    expect(capped.find((q) => q.slot === 1)?.size).toBe(5n);
    expect(capped.find((q) => q.slot === 0)?.size).toBe(10n);
  });

  it("drops the deepest bid entirely when it is not enough", () => {
    const tighter = capBids(quotes, 500n, cost);
    expect(tighter.find((q) => q.slot === 1)).toBeUndefined();
    expect(tighter.find((q) => q.slot === 0)?.size).toBe(5n);
    expect(tighter.find((q) => q.slot === 32)?.size).toBe(10n);
  });
});
