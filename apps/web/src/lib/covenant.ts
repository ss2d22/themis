"use client";

import { covenantAbi, MAX_SLOTS } from "@covenant/sdk";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { publicClient, withGasMargin } from "./chain";
import { env } from "./env";
import { describeError } from "./errors";

const covenant = () => {
  if (!env.covenant) throw new Error("NEXT_PUBLIC_COVENANT_ADDRESS is not set");
  return { address: env.covenant, abi: covenantAbi } as const;
};

export interface LiveQuote {
  slot: number;
  isBuy: boolean;
  price: bigint;
  size: bigint;
  placedBlock: bigint;
}

/** The escrow's own view of an engagement, read straight from chain every block or two. */
export function useLiveCovenant(id: bigint) {
  return useQuery({
    queryKey: ["covenant", id.toString()],
    refetchInterval: 1_500,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const c = covenant();
      const [engagement, metrics, vested, retainerEarned, netSold, netBought] = await publicClient.multicall({
        allowFailure: false,
        contracts: [
          { ...c, functionName: "engagement", args: [id] },
          { ...c, functionName: "metrics", args: [id] },
          { ...c, functionName: "vested", args: [id] },
          { ...c, functionName: "retainerEarned", args: [id] },
          { ...c, functionName: "netSold", args: [id] },
          { ...c, functionName: "netBought", args: [id] },
        ],
      });
      const indexes = [...Array(MAX_SLOTS).keys()].filter((i) => (engagement.liveMask >> BigInt(i)) & 1n);
      const slots = indexes.length
        ? await publicClient.multicall({
            allowFailure: false,
            contracts: indexes.map((i) => ({ ...c, functionName: "slot", args: [id, i] }) as const),
          })
        : [];
      const quotes: LiveQuote[] = slots.map((s, k) => ({
        slot: indexes[k] ?? 0,
        isBuy: s.isBuy,
        price: BigInt(s.price),
        size: s.size,
        placedBlock: s.placedBlock,
      }));
      return { engagement, metrics, vested, retainerEarned, netSold, netBought, quotes };
    },
  });
}

export type LiveCovenant = NonNullable<ReturnType<typeof useLiveCovenant>["data"]>;

type Action =
  | "poke"
  | "closeEpoch"
  | "clawback"
  | "terminate"
  | "releaseBackstop"
  | "claimRetainer"
  | "settle"
  | "cancel";

export interface ActionState {
  pending: Action | null;
  result: { action: Action; ok: boolean; message: string; hash?: string } | null;
}

/** Simulates, sends and confirms escrow calls from the connected wallet. */
export function useCovenantActions(id: bigint) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ActionState>({ pending: null, result: null });

  async function run(action: Action) {
    if (!address) return;
    setState({ pending: action, result: null });
    try {
      const c = covenant();
      const args = action === "settle" ? ([id, 0n] as const) : ([id] as const);
      const { request } = await publicClient.simulateContract({
        ...c,
        functionName: action,
        args,
        account: address,
      } as Parameters<typeof publicClient.simulateContract>[0]);
      const hash = await writeContractAsync(
        await withGasMargin(request as Parameters<typeof writeContractAsync>[0]),
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState({
        pending: null,
        result: { action, ok: receipt.status === "success", message: receipt.status, hash },
      });
      await queryClient.invalidateQueries();
    } catch (error) {
      setState({ pending: null, result: { action, ok: false, message: describeError(error) } });
    }
  }

  return { ...state, run, connected: Boolean(address), address };
}
