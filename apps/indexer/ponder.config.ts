import { covenantAbi, kuruOrderBookAbi, outcomeMarketAbi } from "@covenant/sdk";
import { createConfig, factory } from "ponder";
import { type Address, getAbiItem } from "viem";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const covenant = env("COVENANT_ADDRESS") as Address;
const startBlock = Number(env("START_BLOCK"));

export default createConfig({
  chains: {
    monad: {
      id: 10143,
      rpc: env("PONDER_RPC_URL_10143"),
      pollingInterval: 1_000,
    },
  },
  contracts: {
    Covenant: { chain: "monad", abi: covenantAbi, address: covenant, startBlock },
    OutcomeMarket: {
      chain: "monad",
      abi: outcomeMarketAbi,
      address: env("OUTCOME_MARKET_ADDRESS") as Address,
      startBlock,
    },
    // Every Kuru market an agreement is proposed on, so fills against covenant accounts are recorded.
    KuruMarket: {
      chain: "monad",
      abi: kuruOrderBookAbi,
      address: factory({
        address: covenant,
        event: getAbiItem({ abi: covenantAbi, name: "Proposed" }),
        parameter: "market",
      }),
      startBlock,
    },
  },
});
