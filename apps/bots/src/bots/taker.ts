import { kuruAccountCoreAbi, kuruOrderBookAbi, kuruTestnet, readMarketUnits } from "@covenant/sdk";
import { publicClientFor, send, walletFor } from "../chain.js";
import { type Config, required } from "../config.js";
import type { Logger } from "../log.js";
import { jitter, sleep } from "../time.js";

export interface TakerOptions {
  minQuote: number;
  maxQuote: number;
  whaleEvery: number;
  whaleQuote: number;
  minDelayMs: number;
  maxDelayMs: number;
  slippageBps: bigint;
}

export const defaultTaker: TakerOptions = {
  minQuote: 15,
  maxQuote: 120,
  whaleEvery: 25,
  whaleQuote: 600,
  minDelayMs: 3_000,
  maxDelayMs: 15_000,
  slippageBps: 100n,
};

/** Random retail flow with the occasional large order, traded from the taker's own Kuru account. */
export async function runTaker(config: Config, log: Logger, options = defaultTaker) {
  const client = publicClientFor(config.RPC_URL);
  const wallet = walletFor(config.RPC_URL, required(config, "TAKER_KEY"));
  const market = config.KURU_MARKET;
  const units = await readMarketUnits(client, market);
  const userId = await client.readContract({
    address: kuruTestnet.accountCore,
    abi: kuruAccountCoreAbi,
    functionName: "rootAccountIdOf",
    args: [wallet.account.address],
  });
  if (userId === 0) throw new Error("taker has no Kuru account; run `setup taker` first");
  log.info({ market, userId }, "taker started");

  for (let trade = 1; ; trade++) {
    const isBuy = Math.random() < 0.5;
    const notional =
      trade % options.whaleEvery === 0 ? options.whaleQuote : jitter(options.minQuote, options.maxQuote);
    const [bid, ask] = await client.readContract({
      address: market,
      abi: kuruOrderBookAbi,
      functionName: "bestBidAsk",
    });
    const quoteAtoms = BigInt(Math.floor(notional * 10 ** units.quoteDecimals));
    const amountIn = isBuy
      ? quoteAtoms
      : (quoteAtoms * units.sizePrecision * units.pricePrecision * units.baseSizeMultiplier) /
        (BigInt(bid || ask) * 10n ** BigInt(units.quoteDecimals));

    const estimate = await client.readContract({
      address: market,
      abi: kuruOrderBookAbi,
      functionName: "estimateSwap",
      args: [isBuy, amountIn],
    });
    const minOut = (estimate.amountOut * (10_000n - options.slippageBps)) / 10_000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);
    const result = await send(client, wallet, {
      address: market,
      abi: kuruOrderBookAbi,
      functionName: "swap",
      args: [userId, isBuy, amountIn, minOut, deadline],
    });
    log.info(
      {
        trade,
        side: isBuy ? "buy" : "sell",
        notional: Math.round(notional),
        ok: result.ok,
        ...(result.ok ? { tx: result.hash } : { reason: result.reason }),
      },
      "swap",
    );
    await sleep(jitter(options.minDelayMs, options.maxDelayMs));
  }
}
