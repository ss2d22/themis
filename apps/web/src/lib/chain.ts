"use client";

import { kuruOrderBookAbi, type MarketUnits } from "@covenant/sdk";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type Address, createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { createConfig, injected } from "wagmi";
import { env } from "./env";

export const chain = { ...monadTestnet, rpcUrls: { default: { http: [env.rpcUrl] } } };

export const publicClient = createPublicClient({ chain, transport: http(env.rpcUrl, { batch: true }) });

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: { [chain.id]: http(env.rpcUrl, { batch: true }) },
  ssr: true,
});

export function useHead() {
  return useQuery({
    queryKey: ["head"],
    queryFn: async () => {
      const started = performance.now();
      const block = await publicClient.getBlockNumber({ cacheTime: 0 });
      return { block, latencyMs: Math.round(performance.now() - started) };
    },
    refetchInterval: 1_000,
    placeholderData: keepPreviousData,
  });
}

export interface MarketInfo extends MarketUnits {
  baseSymbol: string;
  quoteSymbol: string;
  baseDecimals: number;
}

export interface BookLevel {
  price: bigint;
  size: bigint;
}

export function useBook(market: Address | undefined, levels = 16) {
  return useQuery({
    queryKey: ["book", market, levels],
    enabled: Boolean(market),
    refetchInterval: 1_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [bidPrices, bidSizes, askPrices, askSizes] = await publicClient.readContract({
        address: market as Address,
        abi: kuruOrderBookAbi,
        functionName: "getL2Book",
        args: [BigInt(levels)],
      });
      const zip = (prices: readonly number[], sizes: readonly bigint[]): BookLevel[] =>
        prices.map((p, i) => ({ price: BigInt(p), size: sizes[i] ?? 0n })).filter((l) => l.size > 0n);
      return { bids: zip(bidPrices, bidSizes), asks: zip(askPrices, askSizes) };
    },
  });
}

/**
 * Adds a margin to a simulated request's gas. Estimates are taken against the pre-block state, and Monad charges
 * the full limit, so the margin is modest rather than generous.
 */
export async function withGasMargin<T extends object>(request: T): Promise<T & { gas: bigint }> {
  const estimate = await publicClient.estimateContractGas(
    request as Parameters<typeof publicClient.estimateContractGas>[0],
  );
  return { ...request, gas: (estimate * 125n) / 100n };
}
