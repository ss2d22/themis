import {
  covenantAbi,
  encodeOps,
  kuruAccountCoreAbi,
  kuruOrderBookAbi,
  kuruTestnet,
  quoteForSize,
  readMarketUnits,
  Template,
  toRawSize,
} from "@covenant/sdk";
import type { Address, Hex } from "viem";
import { publicClientFor, send, walletFor } from "../chain.js";
import { type Config, required } from "../config.js";
import { CovenantReader, Status } from "../covenant.js";
import type { Logger } from "../log.js";
import { externalMid } from "../strategy/fair.js";
import { capBids, skewedMid } from "../strategy/inventory.js";
import { buildLadder, capAsks, capSide, planRequote, withinBand } from "../strategy/ladder.js";
import { sleep } from "../time.js";

export interface MarketMakerOptions {
  levels: number;
  firstOffsetBps: number;
  stepBps: number;
  sizePerLevel: number;
  toleranceBps: number;
  depthBufferBps: bigint;
  skewBpsPerLoan: number;
  maxSkewBps: number;
  heartbeatBlocks: bigint;
  intervalMs: number;
}

export const defaultMarketMaker: MarketMakerOptions = {
  levels: 3,
  firstOffsetBps: 5,
  stepBps: 15,
  sizePerLevel: 0.08,
  toleranceBps: 3,
  depthBufferBps: 2_000n,
  skewBpsPerLoan: 20,
  maxSkewBps: 25,
  heartbeatBlocks: 100n,
  intervalMs: 1_200,
};

/** Keeps a compliant ladder on the book and observes often enough that every interval is credited. */
export async function runMarketMaker(config: Config, log: Logger, options = defaultMarketMaker) {
  const client = publicClientFor(config.RPC_URL);
  const wallet = walletFor(config.RPC_URL, required(config, "OPERATOR_KEY"));
  const covenant = required(config, "COVENANT_ADDRESS");
  const id = required(config, "ENGAGEMENT_ID");
  const reader = new CovenantReader(client, covenant);

  const initial = await reader.engagement(id);
  const market = initial.terms.market;
  const units = await readMarketUnits(client, market);
  const size = toRawSize(options.sizePerLevel, units);
  log.info({ id: id.toString(), market, operator: wallet.account.address }, "market maker started");

  for (;;) {
    const [block, e] = await Promise.all([client.getBlockNumber(), reader.engagement(id)]);
    if (e.status !== Status.Active || block >= e.endBlock) {
      log.info({ status: e.status }, "engagement no longer quotable, stopping");
      return;
    }

    const core = { address: kuruTestnet.accountCore, abi: kuruAccountCoreAbi } as const;
    const [live, book, netSold, netBought, metrics, freeBase, freeQuote, reserves] = await Promise.all([
      reader.liveSlots(id, market, e.account, e.liveMask),
      client.readContract({ address: market, abi: kuruOrderBookAbi, functionName: "getL2Book", args: [10n] }),
      reader.netSold(id),
      reader.netBought(id),
      reader.metrics(id),
      client.readContract({ ...core, functionName: "getBalance", args: [e.account, units.base] }),
      client.readContract({ ...core, functionName: "getBalance", args: [e.account, units.quote] }),
      client.readContract({
        address: market,
        abi: kuruOrderBookAbi,
        functionName: "makerLockedReserves",
        args: [e.account],
      }),
    ]);
    const [bidPrices, bidSizes, askPrices, askSizes] = book;
    const refPrice = BigInt(e.refPrice);
    // Replacing quotes releases their reserves first, so held inventory is free balance plus what is resting.
    const baseHeld = freeBase + reserves[0];
    const quoteHeld = freeQuote + reserves[1];
    const fair = externalMid({ bidPrices, bidSizes, askPrices, askSizes }, live) ?? refPrice;
    const mid = skewedMid(fair, baseHeld, e.terms.loan, options.skewBpsPerLoan, options.maxSkewBps);

    const headroom = e.terms.risk.maxNetSell > netSold ? e.terms.risk.maxNetSell - netSold : 0n;
    const sellable = headroom < baseHeld ? headroom : baseHeld;
    const maxAskSize = (sellable * 9n) / 10n / units.baseSizeMultiplier;
    const template = e.terms.template as Template;
    const sides =
      template === Template.Buyback
        ? ["buy"]
        : template === Template.Distribution
          ? ["sell"]
          : ["buy", "sell"];
    const buyRoom = e.terms.risk.maxNetSell > netBought ? e.terms.risk.maxNetSell - netBought : 0n;
    const withFee = (q: { size: bigint; price: bigint }) =>
      (quoteForSize(q.size, q.price, units) * 10_010n) / 10_000n;
    const ladder = capBids(
      capAsks(
        withinBand(
          buildLadder(mid, { ...options, sizePerLevel: size }, units.tickSize),
          refPrice,
          e.terms.risk.priceBandBps - 10,
        ),
        maxAskSize,
      ),
      (quoteHeld * 95n) / 100n,
      withFee,
    );
    // One-sided templates only admit one side; buybacks also pace the base they buy.
    const sided = ladder.filter((q) => sides.includes(q.side));
    const desired =
      template === Template.Buyback
        ? capSide(sided, "buy", (buyRoom * 9n) / 10n / units.baseSizeMultiplier)
        : sided;

    // Partial fills shrink orders without freeing their slots, so top a side up when its depth runs low.
    const buffered = (target: bigint) => (target * (10_000n + options.depthBufferBps)) / 10_000n;
    const refresh = new Set<"buy" | "sell">();
    if (metrics.bidDepth < buffered(e.terms.ob.minBidDepth)) refresh.add("buy");
    if (metrics.askDepth < buffered(e.terms.ob.minAskDepth)) refresh.add("sell");

    const plan = planRequote(
      desired,
      live,
      block,
      BigInt(e.terms.ob.minQuoteLifeBlocks),
      options.toleranceBps,
      refresh,
    );
    if (plan.ops.length > 0) {
      await quote(log, client, wallet, covenant, id, plan.ops, {
        ...plan,
        refresh: [...refresh],
        mid: mid.toString(),
        fair: fair.toString(),
        block,
      });
    } else if (block - e.lastObsBlock >= options.heartbeatBlocks) {
      const result = await send(client, wallet, {
        address: covenant,
        abi: covenantAbi,
        functionName: "poke",
        args: [id],
      });
      log.info({ ok: result.ok, block: block.toString() }, "heartbeat");
    }
    await sleep(options.intervalMs);
  }
}

async function quote(
  log: Logger,
  client: ReturnType<typeof publicClientFor>,
  wallet: ReturnType<typeof walletFor>,
  covenant: Address,
  id: bigint,
  ops: Hex[],
  context: Record<string, unknown>,
) {
  const result = await send(client, wallet, {
    address: covenant,
    abi: covenantAbi,
    functionName: "quote",
    args: [id, encodeOps(ops)],
  });
  const fields = { ...context, block: String(context.block), ops: ops.length };
  if (result.ok) log.info({ ...fields, tx: result.hash, gas: result.receipt.gasUsed.toString() }, "requoted");
  else log.warn({ ...fields, reason: result.reason, args: result.args?.map(String) }, "requote rejected");
}
