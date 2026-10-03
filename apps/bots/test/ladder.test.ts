import { decodeOp } from "@covenant/sdk";
import { describe, expect, it } from "vitest";
import type { LiveSlot } from "../src/covenant.js";
import { externalMid } from "../src/strategy/fair.js";
import { buildLadder, capAsks, planRequote, withinBand } from "../src/strategy/ladder.js";

const cfg = { levels: 3, firstOffsetBps: 5, stepBps: 15, sizePerLevel: 100n };

describe("buildLadder", () => {
  it("places bids below and asks above the mid on tick", () => {
    const quotes = buildLadder(200_000n, cfg, 10n);
    expect(quotes.filter((q) => q.side === "buy").map((q) => q.price)).toEqual([
      199_900n,
      199_600n,
      199_300n,
    ]);
    expect(quotes.filter((q) => q.side === "sell").map((q) => q.price)).toEqual([
      200_100n,
      200_400n,
      200_700n,
    ]);
    expect(quotes.map((q) => q.slot)).toEqual([0, 32, 1, 33, 2, 34]);
  });
});

describe("capAsks", () => {
  it("trims the deepest asks first", () => {
    const capped = capAsks(buildLadder(200_000n, cfg, 1n), 150n);
    const asks = capped.filter((q) => q.side === "sell");
    expect(asks.map((q) => [q.slot, q.size])).toEqual([
      [32, 100n],
      [33, 50n],
    ]);
    expect(capped.filter((q) => q.side === "buy")).toHaveLength(3);
  });
});

describe("withinBand", () => {
  it("drops quotes outside the escrow band", () => {
    const quotes = buildLadder(200_000n, cfg, 1n);
    expect(withinBand(quotes, 200_000n, 20)).toHaveLength(4);
  });
});

describe("planRequote", () => {
  const desired = buildLadder(200_000n, { ...cfg, levels: 1 }, 1n);
  const live = (slot: number, isBuy: boolean, price: bigint, placedBlock = 0n): LiveSlot => ({
    slot,
    isBuy,
    price,
    size: 100n,
    placedBlock,
  });

  it("places every missing quote", () => {
    expect(planRequote(desired, [], 10n, 3n, 2).placed).toBe(2);
  });

  it("leaves quotes within tolerance alone", () => {
    const plan = planRequote(desired, [live(0, true, 199_895n), live(32, false, 200_100n)], 10n, 3n, 2);
    expect(plan.ops).toHaveLength(0);
  });

  it("replaces drifted quotes but not young ones", () => {
    const plan = planRequote(
      desired,
      [live(0, true, 199_000n, 9n), live(32, false, 201_000n, 1n)],
      10n,
      3n,
      2,
    );
    expect(plan.ops.map((o) => decodeOp(o).slot)).toEqual([32]);
  });

  it("re-places a side flagged for refresh even when on target", () => {
    const plan = planRequote(
      desired,
      [live(0, true, 199_900n), live(32, false, 200_100n)],
      10n,
      3n,
      2,
      new Set(["sell"]),
    );
    expect(plan.ops.map((o) => decodeOp(o).slot)).toEqual([32]);
  });

  it("cancels quotes that are no longer wanted", () => {
    const plan = planRequote(
      desired,
      [live(0, true, 199_900n), live(32, false, 200_100n), live(5, true, 199_000n)],
      10n,
      3n,
      2,
    );
    expect(plan.cancelled).toBe(1);
    expect(decodeOp(plan.ops[0] as `0x${string}`)).toMatchObject({ slot: 5, price: 0n, size: 0n });
  });
});

describe("externalMid", () => {
  const book = {
    bidPrices: [199_900, 199_500],
    bidSizes: [100n, 300n],
    askPrices: [200_100, 200_600],
    askSizes: [100n, 300n],
  };

  it("ignores levels made only of our own quotes", () => {
    const own: LiveSlot[] = [
      { slot: 0, isBuy: true, price: 199_900n, size: 100n, placedBlock: 0n },
      { slot: 32, isBuy: false, price: 200_100n, size: 100n, placedBlock: 0n },
    ];
    expect(externalMid(book, own)).toBe(200_050n);
  });

  it("returns undefined for a one-sided book", () => {
    expect(externalMid({ ...book, askPrices: [], askSizes: [] }, [])).toBeUndefined();
  });
});
