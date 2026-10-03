/** Agreement terms in human units. Converted to raw units against the live market at setup time. */
export interface Preset {
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

export const presets = { launch, exchangeGrade, demo } as const;
export type PresetName = keyof typeof presets;
