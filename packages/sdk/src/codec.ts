import { concatHex, type Hex, numberToHex } from "viem";

/** Flag bits in a Kuru packed slot operation. */
export const SlotFlag = {
  Buy: 1,
  PostOnly: 8,
} as const;

export const MAX_SLOTS = 62;

export type Side = "buy" | "sell";

export interface Quote {
  slot: number;
  side: Side;
  price: bigint;
  size: bigint;
}

export interface DecodedOp {
  slot: number;
  flags: number;
  price: bigint;
  size: bigint;
  minSizeAfterBlock: bigint;
}

function assertSlot(slot: number) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_SLOTS)
    throw new RangeError(`slot ${slot} out of range`);
}

/** Post-only quote into a chosen slot. Covenant rejects anything else. */
export function encodeQuote({ slot, side, price, size }: Quote): Hex {
  assertSlot(slot);
  if (price <= 0n || price >= 2n ** 32n) throw new RangeError(`price ${price} out of range`);
  if (size <= 0n || size >= 2n ** 96n) throw new RangeError(`size ${size} out of range`);
  const flags = BigInt(SlotFlag.PostOnly | (side === "buy" ? SlotFlag.Buy : 0));
  return numberToHex(BigInt(slot) | (flags << 8n) | (price << 16n) | (size << 48n), { size: 32 });
}

export function encodeCancel(slot: number): Hex {
  assertSlot(slot);
  return numberToHex(BigInt(slot), { size: 32 });
}

export function encodeOps(ops: Hex[]): Hex {
  return ops.length === 0 ? "0x" : concatHex(ops);
}

export function decodeOp(word: Hex): DecodedOp {
  const w = BigInt(word);
  return {
    slot: Number(w & 0xffn),
    flags: Number((w >> 8n) & 0xffn),
    price: (w >> 16n) & 0xffffffffn,
    size: (w >> 48n) & ((1n << 96n) - 1n),
    minSizeAfterBlock: (w >> 144n) & 0xffffffffn,
  };
}
