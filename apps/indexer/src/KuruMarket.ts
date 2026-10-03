import { ponder } from "ponder:registry";
import { covenantAccount, engagement, fill } from "ponder:schema";
import { decodeTradesPacked } from "@covenant/sdk";
import { bump } from "./stats";

/** Records every fill, partial or full, against a covenant-owned Kuru account. */
ponder.on("KuruMarket:TradesPacked", async ({ event, context }) => {
  const trades = decodeTradesPacked(event.args.packedTrades);
  for (const [i, trade] of trades.entries()) {
    if (trade.passive || trade.makerId === 0) continue;
    const owner = await context.db.find(covenantAccount, { account: trade.makerId });
    if (!owner) continue;
    await context.db.insert(fill).values({
      id: `${event.id}-${i}`,
      engagementId: owner.engagementId,
      block: event.block.number,
      timestamp: event.block.timestamp,
      tx: event.transaction.hash,
      takerAccount: event.args.accountId,
      slot: trade.slot,
      makerIsBuy: trade.makerIsBuy,
      price: trade.price,
      size: trade.fillSize,
      remaining: trade.updatedSize,
    });
    await context.db.update(engagement, { id: owner.engagementId }).set((row) => ({ fills: row.fills + 1 }));
    await bump(context.db, { fills: 1 });
  }
});
