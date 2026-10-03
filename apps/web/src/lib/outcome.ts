"use client";

import { covenantAbi, kuruErrorName, outcomeMarketAbi } from "@covenant/sdk";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Address, BaseError, ContractFunctionRevertedError, erc20Abi, maxUint256 } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { publicClient } from "./chain";
import { env } from "./env";
import type { OutcomeMarket } from "./types";

export interface Progress {
  from: bigint;
  to: bigint;
  head: bigint;
  credited: bigint;
  elapsed: bigint;
  length: bigint;
  missed: bigint;
  allowance: bigint;
  targetBps: number;
  /** KEPT is impossible once more blocks were missed than the target allows. */
  decided: "kept-possible" | "broken-locked";
}

/** Where a period stands against its uptime target, from the escrow's epoch ledger. */
export function useOutcomeProgress(m: OutcomeMarket | undefined, targetBps: number | undefined) {
  return useQuery({
    queryKey: ["outcome-progress", m?.id],
    enabled: Boolean(m && env.covenant && targetBps !== undefined),
    refetchInterval: 2_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Progress> => {
      const market = m as OutcomeMarket;
      const c = { address: env.covenant as Address, abi: covenantAbi } as const;
      const id = BigInt(market.engagementId);
      const epochs = Array.from({ length: market.epochCount }, (_, k) => market.firstEpoch + k);
      const [first, last, head, ...credits] = await Promise.all([
        publicClient.readContract({ ...c, functionName: "epochBounds", args: [id, market.firstEpoch] }),
        publicClient.readContract({
          ...c,
          functionName: "epochBounds",
          args: [id, market.firstEpoch + market.epochCount - 1],
        }),
        publicClient.getBlockNumber({ cacheTime: 0 }),
        ...epochs.map((e) =>
          publicClient.readContract({ ...c, functionName: "epochCredit", args: [id, BigInt(e)] }),
        ),
      ]);
      const from = first[0];
      const to = last[1];
      const credited = credits.reduce((s, v) => s + BigInt(v), 0n);
      const now = head < to ? head : to;
      const elapsed = now > from ? now - from : 0n;
      const length = to - from;
      const missed = elapsed > credited ? elapsed - credited : 0n;
      const allowance = (length * BigInt(10_000 - (targetBps ?? 0))) / 10_000n;
      return {
        from,
        to,
        head,
        credited,
        elapsed,
        length,
        missed,
        allowance,
        targetBps: targetBps ?? 0,
        decided: missed > allowance ? "broken-locked" : "kept-possible",
      };
    },
  });
}

export function useOutcomeBalances(m: OutcomeMarket | undefined, collateral: Address | undefined) {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["outcome-balances", m?.id, address],
    enabled: Boolean(m && address && collateral && env.outcomeMarket),
    refetchInterval: 3_000,
    queryFn: async () => {
      const market = m as OutcomeMarket;
      const owner = address as Address;
      const [kept, broken, cash, allowance] = await Promise.all([
        publicClient.readContract({
          address: market.kept as Address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
        }),
        publicClient.readContract({
          address: market.broken as Address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
        }),
        publicClient.readContract({
          address: collateral as Address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
        }),
        publicClient.readContract({
          address: collateral as Address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner, env.outcomeMarket as Address],
        }),
      ]);
      return { kept, broken, cash, allowance };
    },
  });
}

type Action = "approve" | "mintSet" | "redeemSet" | "redeem";

function reason(error: unknown) {
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError)
      return revert.data?.errorName ?? kuruErrorName(revert.raw) ?? revert.shortMessage;
    return error.shortMessage;
  }
  return String(error);
}

export function useOutcomeActions(marketId: string | undefined, collateral: Address | undefined) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string; hash?: string } | null>(null);

  async function run(action: Action, amount: bigint) {
    if (!address || !marketId || !env.outcomeMarket || !collateral) return;
    setPending(action);
    setMessage(null);
    try {
      const request =
        action === "approve"
          ? (
              await publicClient.simulateContract({
                address: collateral,
                abi: erc20Abi,
                functionName: "approve",
                args: [env.outcomeMarket, maxUint256],
                account: address,
              })
            ).request
          : (
              await publicClient.simulateContract({
                address: env.outcomeMarket,
                abi: outcomeMarketAbi,
                functionName: action,
                args: [BigInt(marketId), amount],
                account: address,
              })
            ).request;
      const hash = await writeContractAsync(request as Parameters<typeof writeContractAsync>[0]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setMessage({
        ok: receipt.status === "success",
        text: receipt.status === "success" ? "Confirmed" : "Reverted",
        hash,
      });
      await queryClient.invalidateQueries();
    } catch (error) {
      setMessage({ ok: false, text: reason(error) });
    } finally {
      setPending(null);
    }
  }

  return { run, pending, message, connected: Boolean(address) };
}
