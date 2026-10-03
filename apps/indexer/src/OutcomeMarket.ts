import { ponder } from "ponder:registry";
import { outcomeMarket } from "ponder:schema";

ponder.on("OutcomeMarket:MarketCreated", async ({ event, context }) => {
  const a = event.args;
  await context.db.insert(outcomeMarket).values({
    id: a.marketId,
    engagementId: a.engagementId,
    firstEpoch: a.firstEpoch,
    epochCount: a.epochCount,
    kept: a.kept,
    broken: a.broken,
    createdAt: event.block.timestamp,
  });
});

ponder.on("OutcomeMarket:SetMinted", async ({ event, context }) => {
  await context.db
    .update(outcomeMarket, { id: event.args.marketId })
    .set((row) => ({ outstanding: row.outstanding + event.args.amount }));
});

ponder.on("OutcomeMarket:SetRedeemed", async ({ event, context }) => {
  await context.db
    .update(outcomeMarket, { id: event.args.marketId })
    .set((row) => ({ outstanding: row.outstanding - event.args.amount }));
});

ponder.on("OutcomeMarket:Resolved", async ({ event, context }) => {
  await context.db
    .update(outcomeMarket, { id: event.args.marketId })
    .set({ outcome: event.args.outcome, credited: event.args.credited, length: event.args.length });
});

ponder.on("OutcomeMarket:Redeemed", async ({ event, context }) => {
  await context.db
    .update(outcomeMarket, { id: event.args.marketId })
    .set((row) => ({ outstanding: row.outstanding - event.args.amount }));
});
