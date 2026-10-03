/** Matches `Covenant.Template`: a market-making mandate, a bid-only buyback, or an ask-only distribution. */
export const Template = { TwoSided: 0, Buyback: 1, Distribution: 2 } as const;
export type Template = (typeof Template)[keyof typeof Template];

/**
 * Agreement terms in human units. Converted to raw units against the live market at setup time. For a buyback the
 * loan is a quote budget; for the other templates it is base.
 */
export interface Preset {
  template: Template;
  loan: number;
  makerCollateral: number;
  bond: number;
  options: number;
  retainer: number;
  strikePremiumBps: number;
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
    minBidDepth: number;
    minAskDepth: number;
  };
  risk: {
    priceBandBps: number;
    maxRefStepBps: number;
    penaltyBps: number;
    breachSlashBps: number;
    sellWindowBlocks: number;
    backstopLockBlocks: number;
    maxNetSell: number;
    watchBounty: number;
    clawbackBounty: number;
  };
}

const HOUR = 9_000;

/** A launch-sized agreement: one-day term, hourly epochs, three failed hours to clawback. */
export const launch: Preset = {
  template: Template.TwoSided,
  loan: 2,
  makerCollateral: 6_000,
  bond: 300,
  options: 1,
  retainer: 600,
  strikePremiumBps: 500,
  termBlocks: 24 * HOUR,
  noticeBlocks: HOUR,
  exerciseWindowBlocks: HOUR / 6,
  ob: {
    maxSpreadBps: 60,
    depthBandBps: 200,
    uptimeTargetBps: 9_000,
    sustainedBreachEpochs: 3,
    volatileSpreadBps: 150,
    volatilityTriggerBps: 150,
    epochBlocks: HOUR,
    maxCreditBlocks: 150,
    minQuoteLifeBlocks: 3,
    graceBlocks: 25,
    minBidDepth: 300,
    minAskDepth: 300,
  },
  risk: {
    priceBandBps: 300,
    maxRefStepBps: 3,
    penaltyBps: 1_000,
    breachSlashBps: 5_000,
    sellWindowBlocks: 24 * HOUR,
    backstopLockBlocks: HOUR,
    maxNetSell: 1,
    watchBounty: 2,
    clawbackBounty: 20,
  },
};

/** Same agreement compressed for a live demo: two-minute epochs, clawable after two failures. */
export const demo: Preset = {
  ...launch,
  termBlocks: 2 * HOUR,
  noticeBlocks: 300,
  exerciseWindowBlocks: 150,
  ob: { ...launch.ob, epochBlocks: 300, sustainedBreachEpochs: 2 },
  risk: { ...launch.risk, sellWindowBlocks: 2 * HOUR, backstopLockBlocks: 300 },
};

/** Tighter, deeper book in the style of a centralised-exchange mandate. */
export const exchangeGrade: Preset = {
  ...launch,
  termBlocks: 7 * 24 * HOUR,
  ob: {
    ...launch.ob,
    maxSpreadBps: 25,
    volatileSpreadBps: 75,
    depthBandBps: 100,
    uptimeTargetBps: 9_500,
    minBidDepth: 1_000,
    minAskDepth: 1_000,
  },
  risk: { ...launch.risk, priceBandBps: 200, sellWindowBlocks: 24 * HOUR },
};

/** A treasury buyback: a quote budget spent through resting bids, at most one token per hour. */
export const buyback: Preset = {
  ...launch,
  template: Template.Buyback,
  loan: 3_000,
  options: 0,
  makerCollateral: 0,
  retainer: 100,
  strikePremiumBps: 0,
  ob: { ...launch.ob, minBidDepth: 300, minAskDepth: 0 },
  risk: { ...launch.risk, maxNetSell: 1, sellWindowBlocks: HOUR },
};

/** An unlock sold into the book through asks only, at most a quarter of a token per hour. */
export const distribution: Preset = {
  ...launch,
  template: Template.Distribution,
  options: 0,
  makerCollateral: 0,
  retainer: 100,
  strikePremiumBps: 0,
  ob: { ...launch.ob, minBidDepth: 0, minAskDepth: 300 },
  risk: { ...launch.risk, maxNetSell: 0.25, sellWindowBlocks: HOUR },
};

export const presets = { launch, exchangeGrade, buyback, distribution, demo } as const;
export type PresetName = keyof typeof presets;
