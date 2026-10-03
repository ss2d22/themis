import { ponder } from "ponder:registry";
import {
  bounty,
  complianceChange,
  covenantAccount,
  engagement,
  epoch,
  observation,
  quote,
  watcher,
} from "ponder:schema";
import { plain } from "./json";
import { bump } from "./stats";

const Status = {
  Proposed: 1,
  Active: 2,
  ClawbackEligible: 3,
  Settled: 4,
  ClawedBack: 5,
  Cancelled: 6,
} as const;

ponder.on("Covenant:Proposed", async ({ event, context }) => {
  const e = await context.client.readContract({
    abi: context.contracts.Covenant.abi,
    address: context.contracts.Covenant.address,
    functionName: "engagement",
    args: [event.args.id],
  });
  await context.db.insert(engagement).values({
    id: event.args.id,
    issuer: event.args.issuer,
    maker: event.args.maker,
    market: event.args.market,
    status: Status.Proposed,
    termsHash: event.args.termsHash,
    terms: plain(e.terms),
    proposedAt: event.block.timestamp,
  });
  await bump(context.db, { engagements: 1 });
});

ponder.on("Covenant:Accepted", async ({ event, context }) => {
  const { id, account, operator, startBlock, endBlock } = event.args;
  await context.db.update(engagement, { id }).set({
    status: Status.Active,
    account,
    operator,
    startBlock,
    endBlock,
    lastObservedBlock: startBlock,
  });
  await context.db.insert(covenantAccount).values({ account, engagementId: id });
});

ponder.on("Covenant:Cancelled", async ({ event, context }) => {
  await context.db
    .update(engagement, { id: event.args.id })
    .set({ status: Status.Cancelled, closedAt: event.block.timestamp });
});

ponder.on("Covenant:OperatorSet", async ({ event, context }) => {
  await context.db.update(engagement, { id: event.args.id }).set({ operator: event.args.operator });
});

ponder.on("Covenant:HookEnabled", async ({ event, context }) => {
  await context.db.update(engagement, { id: event.args.id }).set({ hookEnabled: true });
});

ponder.on("Covenant:Quoted", async ({ event, context }) => {
  const ops = (event.args.ops.length - 2) / 64;
  await context.db.insert(quote).values({
    id: event.id,
    engagementId: event.args.id,
    block: event.block.number,
    timestamp: event.block.timestamp,
    tx: event.transaction.hash,
    ops,
  });
  await context.db.update(engagement, { id: event.args.id }).set((row) => ({ quotes: row.quotes + 1 }));
  await bump(context.db, { quotes: 1 });
});

ponder.on("Covenant:QuoteSkipped", async ({ event, context }) => {
  await context.db
    .update(engagement, { id: event.args.id })
    .set((row) => ({ skippedQuotes: row.skippedQuotes + 1 }));
});

ponder.on("Covenant:Observed", async ({ event, context }) => {
  const a = event.args;
  await context.db.insert(observation).values({
    id: event.id,
    engagementId: a.id,
    block: event.block.number,
    timestamp: event.block.timestamp,
    compliant: a.compliant,
    credited: a.credited,
    refPrice: BigInt(a.refPrice),
    bestBid: BigInt(a.bestBid),
    bestAsk: BigInt(a.bestAsk),
    bidDepth: a.bidDepth,
    askDepth: a.askDepth,
  });
  await context.db.update(engagement, { id: a.id }).set((row) => ({
    compliant: a.compliant,
    creditedBlocks: row.creditedBlocks + a.credited,
    lastObservedBlock: event.block.number,
    refPrice: BigInt(a.refPrice),
    bestBid: BigInt(a.bestBid),
    bestAsk: BigInt(a.bestAsk),
    bidDepth: a.bidDepth,
    askDepth: a.askDepth,
    observations: row.observations + 1,
  }));
  await bump(context.db, { observations: 1, blocksCredited: a.credited });
});

ponder.on("Covenant:ComplianceChanged", async ({ event, context }) => {
  const { id, compliant } = event.args;
  await context.db.insert(complianceChange).values({
    id: event.id,
    engagementId: id,
    block: event.block.number,
    timestamp: event.block.timestamp,
    compliant,
    tx: event.transaction.hash,
  });
  if (!compliant) {
    await context.db.update(engagement, { id }).set((row) => ({ breaches: row.breaches + 1 }));
    await bump(context.db, { breaches: 1 });
  }
});

ponder.on("Covenant:EpochClosed", async ({ event, context }) => {
  const a = event.args;
  await context.db.insert(epoch).values({
    engagementId: a.id,
    epoch: a.epoch,
    credited: a.credited,
    length: a.length,
    passed: a.passed,
    streak: a.streak,
    closedBy: event.transaction.from,
    block: event.block.number,
    tx: event.transaction.hash,
  });
  await context.db.update(engagement, { id: a.id }).set((row) => ({
    epochsPassed: row.epochsPassed + (a.passed ? 1 : 0),
    epochsFailed: row.epochsFailed + (a.passed ? 0 : 1),
    failingStreak: a.streak,
  }));
  await bump(context.db, { epochsClosed: 1 });
});

ponder.on("Covenant:ClawbackEligible", async ({ event, context }) => {
  await context.db.update(engagement, { id: event.args.id }).set({ status: Status.ClawbackEligible });
});

ponder.on("Covenant:BountyPaid", async ({ event, context }) => {
  const { id, to, amount } = event.args;
  await context.db.insert(bounty).values({
    id: event.id,
    engagementId: id,
    watcher: to,
    amount,
    block: event.block.number,
    tx: event.transaction.hash,
  });
  await context.db
    .insert(watcher)
    .values({ address: to, bounties: 1, earned: amount })
    .onConflictDoUpdate((row) => ({ bounties: row.bounties + 1, earned: row.earned + amount }));
  await context.db.update(engagement, { id }).set((row) => ({ bountiesPaid: row.bountiesPaid + amount }));
  await bump(context.db, { bountiesPaid: amount });
});

ponder.on("Covenant:Terminated", async ({ event, context }) => {
  await context.db.update(engagement, { id: event.args.id }).set({ endBlock: event.args.endBlock });
});

ponder.on("Covenant:Settled", async ({ event, context }) => {
  await context.db.update(engagement, { id: event.args.id }).set({
    status: Status.Settled,
    settlement: plain(event.args.result),
    closedAt: event.block.timestamp,
  });
  await bump(context.db, { settlements: 1 });
});

ponder.on("Covenant:ClawedBack", async ({ event, context }) => {
  await context.db.update(engagement, { id: event.args.id }).set({
    status: Status.ClawedBack,
    endBlock: event.block.number,
    settlement: plain(event.args.result),
    backstopPosition: event.args.backstopPosition,
    closedAt: event.block.timestamp,
  });
  await bump(context.db, { clawbacks: 1 });
});

ponder.on("Covenant:RetainerClaimed", async ({ event, context }) => {
  await context.db
    .update(engagement, { id: event.args.id })
    .set((row) => ({ retainerClaimed: row.retainerClaimed + event.args.amount }));
});
