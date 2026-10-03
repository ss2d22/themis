/** Shapes served by the indexer API. Bigints arrive as decimal strings. */

export type Status = 1 | 2 | 3 | 4 | 5 | 6;

export const statusLabel: Record<Status, string> = {
  1: "Proposed",
  2: "Active",
  3: "Clawable",
  4: "Settled",
  5: "Clawed back",
  6: "Cancelled",
};

export interface Terms {
  market: string;
  maker: string;
  loan: string;
  makerCollateral: string;
  bond: string;
  options: string;
  retainer: string;
  strike: number;
  initialPrice: number;
  termBlocks: number;
  noticeBlocks: number;
  exerciseWindowBlocks: number;
  ob: {
    maxSpreadBps: number;
    depthBandBps: number;
    uptimeTargetBps: number;
    sustainedBreachEpochs: number;
    volatileSpreadBps: number;
    volatilityTriggerBps: number;
    epochBlocks: number;
    maxCreditBlocks: number;
    minQuoteLifeBlocks: number;
    graceBlocks: number;
    minBidDepth: string;
    minAskDepth: string;
  };
  risk: {
    priceBandBps: number;
    maxRefStepBps: number;
    penaltyBps: number;
    breachSlashBps: number;
    sellWindowBlocks: number;
    backstopLockBlocks: number;
    maxNetSell: string;
    watchBounty: string;
    clawbackBounty: string;
    priceSource: string;
    maxPriceAge: number;
  };
  termsHash: string;
}

export interface Settlement {
  issuerBase: string;
  issuerQuote: string;
  makerBase: string;
  makerQuote: string;
  bondToIssuer: string;
  bondToMaker: string;
  shortfall: string;
  exercised: string;
  deficit: string;
}

export interface Engagement {
  id: string;
  issuer: string;
  maker: string;
  operator: string | null;
  market: string;
  account: number | null;
  status: Status;
  termsHash: string;
  terms: Terms;
  proposedAt: string;
  startBlock: string | null;
  endBlock: string | null;
  hookEnabled: boolean;
  compliant: boolean;
  creditedBlocks: string;
  lastObservedBlock: string | null;
  refPrice: string | null;
  bestBid: string | null;
  bestAsk: string | null;
  bidDepth: string | null;
  askDepth: string | null;
  quotes: number;
  skippedQuotes: number;
  observations: number;
  breaches: number;
  epochsPassed: number;
  epochsFailed: number;
  failingStreak: number;
  fills: number;
  bountiesPaid: string;
  retainerClaimed: string;
  settlement: Settlement | null;
  backstopPosition: string | null;
  closedAt: string | null;
  uptimeBps: number;
}

export interface Observation {
  id: string;
  engagementId: string;
  block: string;
  timestamp: string;
  compliant: boolean;
  credited: string;
  refPrice: string;
  bestBid: string;
  bestAsk: string;
  bidDepth: string;
  askDepth: string;
}

export interface ComplianceChange {
  id: string;
  block: string;
  timestamp: string;
  compliant: boolean;
  tx: string;
}

export interface Epoch {
  engagementId: string;
  epoch: number;
  credited: number;
  length: number;
  passed: boolean;
  streak: number;
  closedBy: string;
  block: string;
  tx: string;
}

export interface Fill {
  id: string;
  block: string;
  timestamp: string;
  tx: string;
  takerAccount: number;
  slot: number;
  makerIsBuy: boolean;
  price: string;
  size: string;
  remaining: string;
}

export interface Bounty {
  id: string;
  watcher: string;
  amount: string;
  block: string;
  tx: string;
}

export interface QuoteEvent {
  id: string;
  block: string;
  timestamp: string;
  tx: string;
  ops: number;
}

export interface OutcomeMarket {
  id: string;
  engagementId: string;
  firstEpoch: number;
  epochCount: number;
  kept: string;
  broken: string;
  outcome: 0 | 1 | 2;
  credited: string | null;
  length: string | null;
  outstanding: string;
  createdAt: string;
}

export interface Report {
  engagement: Engagement;
  head: string;
  observations: Observation[];
  changes: ComplianceChange[];
  epochs: Epoch[];
  fills: Fill[];
  bounties: Bounty[];
  quotes: QuoteEvent[];
  outcomes: OutcomeMarket[];
}

export interface Stats {
  engagements: number;
  quotes: number;
  observations: number;
  blocksCredited: string;
  breaches: number;
  epochsClosed: number;
  clawbacks: number;
  settlements: number;
  fills: number;
  bountiesPaid: string;
  watchers: number;
}

export interface MakerRow {
  maker: string;
  engagements: number;
  credited: string;
  elapsed: string;
  clawbacks: number;
  defaults: number;
  failedEpochs: number;
  uptimeBps: number;
  grade: string;
}

export interface WatcherRow {
  address: string;
  bounties: number;
  earned: string;
}
