import { concatHex, numberToHex } from "viem";
import { describe, expect, it } from "vitest";
import { decodeTradesPacked } from "../src/trades.js";

function record(fields: {
  maker: bigint;
  slot: bigint;
  flags: bigint;
  price: bigint;
  size: bigint;
  orderId: bigint;
  updated: bigint;
  fee: bigint;
  tradeId: bigint;
}) {
  const w0 =
    (fields.maker << 216n) |
    (fields.slot << 208n) |
    (fields.flags << 200n) |
    (fields.price << 168n) |
    (fields.size << 72n) |
    (fields.orderId << 8n);
  const w1 = (fields.updated << 160n) | (fields.fee << 136n) | fields.tradeId;
  return concatHex([numberToHex(w0, { size: 32 }), numberToHex(w1, { size: 32 })]);
}

describe("decodeTradesPacked", () => {
  it("decodes maker, slot, side and sizes", () => {
    const data = concatHex([
      record({
        maker: 6n,
        slot: 32n,
        flags: 0n,
        price: 268_087n,
        size: 300_000_000n,
        orderId: 91n,
        updated: 500_000_000n,
        fee: 4_000n,
        tradeId: 7n,
      }),
      record({
        maker: 0n,
        slot: 1n,
        flags: 2n | 4n,
        price: 268_100n,
        size: 10n,
        orderId: 267_900n,
        updated: 0n,
        fee: 0n,
        tradeId: 8n,
      }),
    ]);
    const [maker, passive] = decodeTradesPacked(data);
    expect(maker).toEqual({
      makerId: 6,
      slot: 32,
      makerIsBuy: false,
      passive: false,
      matchEnd: false,
      price: 268_087n,
      fillSize: 300_000_000n,
      orderId: 91n,
      updatedSize: 500_000_000n,
      makerFeePps: 4_000,
      tradeId: 7n,
    });
    expect(passive).toMatchObject({ passive: true, matchEnd: true, orderId: 267_900n });
  });

  it("rejects truncated data", () => {
    expect(() => decodeTradesPacked("0x1234")).toThrow();
  });
});
