import type { Address } from "viem";

export const env = {
  indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:42069",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  covenant: process.env.NEXT_PUBLIC_COVENANT_ADDRESS as Address | undefined,
  outcomeMarket: process.env.NEXT_PUBLIC_OUTCOME_MARKET_ADDRESS as Address | undefined,
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://testnet.monadvision.com",
};

export const BLOCK_SECONDS = 0.4;

export const explorer = {
  tx: (hash: string) => `${env.explorerUrl}/tx/${hash}`,
  address: (address: string) => `${env.explorerUrl}/address/${address}`,
  block: (block: string | bigint) => `${env.explorerUrl}/block/${block}`,
};
