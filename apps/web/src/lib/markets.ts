"use client";

import { readMarketUnits } from "@covenant/sdk";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { erc20Abi } from "viem";
import { type MarketInfo, publicClient } from "./chain";

async function loadMarket(market: Address): Promise<MarketInfo> {
  const units = await readMarketUnits(publicClient, market);
  const [baseSymbol, quoteSymbol, baseDecimals] = await Promise.all([
    publicClient.readContract({ address: units.base, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: units.quote, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: units.base, abi: erc20Abi, functionName: "decimals" }),
  ]);
  return { ...units, baseSymbol, quoteSymbol, baseDecimals };
}

export const marketQuery = (market: string) => ({
  queryKey: ["market", market],
  queryFn: () => loadMarket(market as Address),
  staleTime: Number.POSITIVE_INFINITY,
});

export function useMarket(market: string | undefined) {
  return useQuery({ ...marketQuery(market ?? ""), enabled: Boolean(market) });
}

/** Market metadata for a set of markets, keyed by address. */
export function useMarkets(markets: string[]) {
  const unique = [...new Set(markets)];
  const results = useQueries({ queries: unique.map(marketQuery) });
  const map = new Map<string, MarketInfo>();
  unique.forEach((m, i) => {
    const data = results[i]?.data;
    if (data) map.set(m.toLowerCase(), data);
  });
  return map;
}

export function priceOf(raw: string | bigint | number, market: MarketInfo): number {
  return Number(raw) / Number(market.pricePrecision);
}

export function pairName(market: MarketInfo | undefined): string {
  return market ? `${market.baseSymbol}/${market.quoteSymbol}` : "—";
}
