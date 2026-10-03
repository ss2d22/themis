import { covenantAbi, kuruOrderBookAbi, MAX_SLOTS } from "@covenant/sdk";
import type { Address, PublicClient } from "viem";

export const Status = {
  None: 0,
  Proposed: 1,
  Active: 2,
  ClawbackEligible: 3,
  Settled: 4,
  ClawedBack: 5,
  Cancelled: 6,
} as const;

export interface LiveSlot {
  slot: number;
  isBuy: boolean;
  price: bigint;
  size: bigint;
  placedBlock: bigint;
}

export class CovenantReader {
  constructor(
    readonly client: PublicClient,
    readonly address: Address,
  ) {}

  engagement(id: bigint) {
    return this.client.readContract({
      address: this.address,
      abi: covenantAbi,
      functionName: "engagement",
      args: [id],
    });
  }

  metrics(id: bigint) {
    return this.client.readContract({
      address: this.address,
      abi: covenantAbi,
      functionName: "metrics",
      args: [id],
    });
  }

  netSold(id: bigint) {
    return this.client.readContract({
      address: this.address,
      abi: covenantAbi,
      functionName: "netSold",
      args: [id],
    });
  }

  count() {
    return this.client.readContract({
      address: this.address,
      abi: covenantAbi,
      functionName: "engagementCount",
    });
  }

  /** Slots the escrow believes are resting, confirmed against Kuru. */
  async liveSlots(id: bigint, market: Address, account: number, liveMask: bigint): Promise<LiveSlot[]> {
    const indexes = [...Array(MAX_SLOTS).keys()].filter((i) => (liveMask >> BigInt(i)) & 1n);
    if (indexes.length === 0) return [];
    const results = await this.client.multicall({
      allowFailure: false,
      contracts: indexes.flatMap((i) => [
        { address: this.address, abi: covenantAbi, functionName: "slot", args: [id, i] } as const,
        { address: market, abi: kuruOrderBookAbi, functionName: "getOrderId", args: [account, i] } as const,
      ]),
    });
    const slots: LiveSlot[] = [];
    indexes.forEach((i, k) => {
      const slot = results[2 * k] as { price: number; size: bigint; placedBlock: bigint; isBuy: boolean };
      const orderId = results[2 * k + 1] as bigint;
      if (orderId === 0n) return;
      slots.push({
        slot: i,
        isBuy: slot.isBuy,
        price: BigInt(slot.price),
        size: slot.size,
        placedBlock: slot.placedBlock,
      });
    });
    return slots;
  }
}
