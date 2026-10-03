import { index, onchainTable, primaryKey, relations } from "ponder";

export const engagement = onchainTable("engagement", (t) => ({
  id: t.bigint().primaryKey(),
  issuer: t.hex().notNull(),
  maker: t.hex().notNull(),
  operator: t.hex(),
  market: t.hex().notNull(),
  account: t.integer(),
  status: t.integer().notNull(),
  termsHash: t.hex().notNull(),
  terms: t.json(),
  proposedAt: t.bigint().notNull(),
  startBlock: t.bigint(),
  endBlock: t.bigint(),
  hookEnabled: t.boolean().notNull().default(false),
  compliant: t.boolean().notNull().default(false),
  creditedBlocks: t.bigint().notNull().default(0n),
  lastObservedBlock: t.bigint(),
  refPrice: t.bigint(),
  bestBid: t.bigint(),
  bestAsk: t.bigint(),
  bidDepth: t.bigint(),
  askDepth: t.bigint(),
  quotes: t.integer().notNull().default(0),
  skippedQuotes: t.integer().notNull().default(0),
  observations: t.integer().notNull().default(0),
  breaches: t.integer().notNull().default(0),
  epochsPassed: t.integer().notNull().default(0),
  epochsFailed: t.integer().notNull().default(0),
  failingStreak: t.integer().notNull().default(0),
  fills: t.integer().notNull().default(0),
  bountiesPaid: t.bigint().notNull().default(0n),
  retainerClaimed: t.bigint().notNull().default(0n),
  settlement: t.json(),
  backstopPosition: t.bigint(),
  closedAt: t.bigint(),
}));

export const covenantAccount = onchainTable("covenant_account", (t) => ({
  account: t.integer().primaryKey(),
  engagementId: t.bigint().notNull(),
}));

export const observation = onchainTable(
  "observation",
  (t) => ({
    id: t.text().primaryKey(),
    engagementId: t.bigint().notNull(),
    block: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    compliant: t.boolean().notNull(),
    credited: t.bigint().notNull(),
    refPrice: t.bigint().notNull(),
    bestBid: t.bigint().notNull(),
    bestAsk: t.bigint().notNull(),
    bidDepth: t.bigint().notNull(),
    askDepth: t.bigint().notNull(),
  }),
  (table) => ({ byEngagement: index().on(table.engagementId, table.block) }),
);

export const complianceChange = onchainTable(
  "compliance_change",
  (t) => ({
    id: t.text().primaryKey(),
    engagementId: t.bigint().notNull(),
    block: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    compliant: t.boolean().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({ byEngagement: index().on(table.engagementId, table.block) }),
);

export const quote = onchainTable(
  "quote",
  (t) => ({
    id: t.text().primaryKey(),
    engagementId: t.bigint().notNull(),
    block: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    tx: t.hex().notNull(),
    ops: t.integer().notNull(),
  }),
  (table) => ({ byEngagement: index().on(table.engagementId, table.block) }),
);

export const fill = onchainTable(
  "fill",
  (t) => ({
    id: t.text().primaryKey(),
    engagementId: t.bigint().notNull(),
    block: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    tx: t.hex().notNull(),
    takerAccount: t.integer().notNull(),
    slot: t.integer().notNull(),
    makerIsBuy: t.boolean().notNull(),
    price: t.bigint().notNull(),
    size: t.bigint().notNull(),
    remaining: t.bigint().notNull(),
  }),
  (table) => ({ byEngagement: index().on(table.engagementId, table.block) }),
);

export const epoch = onchainTable(
  "epoch",
  (t) => ({
    engagementId: t.bigint().notNull(),
    epoch: t.integer().notNull(),
    credited: t.integer().notNull(),
    length: t.integer().notNull(),
    passed: t.boolean().notNull(),
    streak: t.integer().notNull(),
    closedBy: t.hex().notNull(),
    block: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({ pk: primaryKey({ columns: [table.engagementId, table.epoch] }) }),
);

export const bounty = onchainTable("bounty", (t) => ({
  id: t.text().primaryKey(),
  engagementId: t.bigint().notNull(),
  watcher: t.hex().notNull(),
  amount: t.bigint().notNull(),
  block: t.bigint().notNull(),
  tx: t.hex().notNull(),
}));

export const watcher = onchainTable("watcher", (t) => ({
  address: t.hex().primaryKey(),
  bounties: t.integer().notNull(),
  earned: t.bigint().notNull(),
}));

export const outcomeMarket = onchainTable("outcome_market", (t) => ({
  id: t.bigint().primaryKey(),
  engagementId: t.bigint().notNull(),
  firstEpoch: t.integer().notNull(),
  epochCount: t.integer().notNull(),
  kept: t.hex().notNull(),
  broken: t.hex().notNull(),
  outcome: t.integer().notNull().default(0),
  credited: t.bigint(),
  length: t.bigint(),
  outstanding: t.bigint().notNull().default(0n),
  createdAt: t.bigint().notNull(),
}));

export const stats = onchainTable("stats", (t) => ({
  id: t.text().primaryKey(),
  engagements: t.integer().notNull().default(0),
  quotes: t.integer().notNull().default(0),
  observations: t.integer().notNull().default(0),
  blocksCredited: t.bigint().notNull().default(0n),
  breaches: t.integer().notNull().default(0),
  epochsClosed: t.integer().notNull().default(0),
  clawbacks: t.integer().notNull().default(0),
  settlements: t.integer().notNull().default(0),
  fills: t.integer().notNull().default(0),
  bountiesPaid: t.bigint().notNull().default(0n),
}));

export const engagementRelations = relations(engagement, ({ many }) => ({
  observations: many(observation),
  epochs: many(epoch),
  fills: many(fill),
}));

export const observationRelations = relations(observation, ({ one }) => ({
  engagement: one(engagement, { fields: [observation.engagementId], references: [engagement.id] }),
}));

export const epochRelations = relations(epoch, ({ one }) => ({
  engagement: one(engagement, { fields: [epoch.engagementId], references: [engagement.id] }),
}));

export const fillRelations = relations(fill, ({ one }) => ({
  engagement: one(engagement, { fields: [fill.engagementId], references: [engagement.id] }),
}));
