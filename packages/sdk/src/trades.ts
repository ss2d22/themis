import { type Hex, hexToBigInt, size, slice } from "viem";

export interface PackedTrade {
  makerId: number;
  slot: number;
  makerIsBuy: boolean;
  passive: boolean;
  matchEnd: boolean;
  price: bigint;
  fillSize: bigint;
  orderId: bigint;
  updatedSize: bigint;
  makerFeePps: number;
  tradeId: bigint;
}

const RECORD_BYTES = 64;
const mask = (bits: bigint) => (1n << bits) - 1n;

/** Decodes the 64-byte records in a Kuru `TradesPacked` event. */
export function decodeTradesPacked(data: Hex): PackedTrade[] {
  const length = size(data);
  if (length % RECORD_BYTES !== 0) throw new Error(`packed trades length ${length} is not a multiple of 64`);
  const trades: PackedTrade[] = [];
  for (let offset = 0; offset < length; offset += RECORD_BYTES) {
    const w0 = hexToBigInt(slice(data, offset, offset + 32));
    const w1 = hexToBigInt(slice(data, offset + 32, offset + 64));
    const flags = Number((w0 >> 200n) & 0xffn);
    trades.push({
      makerId: Number(w0 >> 216n),
      slot: Number((w0 >> 208n) & 0xffn),
      makerIsBuy: (flags & 1) !== 0,
      passive: (flags & 2) !== 0,
      matchEnd: (flags & 4) !== 0,
      price: (w0 >> 168n) & mask(32n),
      fillSize: (w0 >> 72n) & mask(96n),
      orderId: (w0 >> 8n) & mask(64n),
      updatedSize: w1 >> 160n,
      makerFeePps: Number((w1 >> 136n) & mask(24n)),
      tradeId: w1 & mask(64n),
    });
  }
  return trades;
}
