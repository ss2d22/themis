import { describe, expect, it } from "vitest";
import { decodeOp, encodeCancel, encodeOps, encodeQuote, SlotFlag } from "../src/codec.js";

describe("codec", () => {
  it("round-trips a post-only quote", () => {
    const word = encodeQuote({ slot: 33, side: "sell", price: 267_955n, size: 10_000_000_000n });
    expect(decodeOp(word)).toEqual({
      slot: 33,
      flags: SlotFlag.PostOnly,
      price: 267_955n,
      size: 10_000_000_000n,
      minSizeAfterBlock: 0n,
    });
  });

  it("sets the buy flag for bids", () => {
    const word = encodeQuote({ slot: 0, side: "buy", price: 1n, size: 1n });
    expect(decodeOp(word).flags).toBe(SlotFlag.PostOnly | SlotFlag.Buy);
  });

  it("matches the solidity layout", () => {
    // KuruCodec.encodeOp(SlotOp(7, 9, 267_720, 1e9, 0)) from the fork tests
    const word = encodeQuote({ slot: 7, side: "buy", price: 267_720n, size: 1_000_000_000n });
    expect(word).toBe("0x000000000000000000000000000000000000000000003b9aca00000415c80907");
  });

  it("encodes cancels as zero price and size", () => {
    expect(decodeOp(encodeCancel(5))).toMatchObject({ slot: 5, price: 0n, size: 0n, flags: 0 });
  });

  it("concatenates operations", () => {
    expect(encodeOps([encodeCancel(1), encodeCancel(2)]).length).toBe(2 + 64 * 2);
    expect(encodeOps([])).toBe("0x");
  });

  it("rejects out-of-range values", () => {
    expect(() => encodeCancel(62)).toThrow(RangeError);
    expect(() => encodeQuote({ slot: 0, side: "buy", price: 0n, size: 1n })).toThrow(RangeError);
  });
});

describe("kuruErrorName", () => {
  it("names Kuru errors from raw revert data", async () => {
    const { kuruErrorName } = await import("../src/errors");
    expect(kuruErrorName("0xf4d678b8")).toBe("InsufficientBalance");
    expect(kuruErrorName("0xdeadbeef")).toBeUndefined();
    expect(kuruErrorName(undefined)).toBeUndefined();
  });

  it("finds escrow errors in raw failure messages", async () => {
    const { errorNameIn } = await import("../src/errors");
    expect(errorNameIn('reverted with the following signature:\n0xbbf16ae5')).toBe("QuoteTooYoung");
    expect(errorNameIn("no selector here")).toBeUndefined();
  });
});
