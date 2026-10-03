import type { Preset } from "@covenant/sdk";
import { type Address, isAddress, keccak256, parseUnits, toBytes, zeroAddress, zeroHash } from "viem";
import type { MarketInfo } from "@/lib/chain";
import { BLOCK_SECONDS } from "@/lib/env";

const BLOCKS_PER_MINUTE = 60 / BLOCK_SECONDS;

/** Everything the issuer types, in human units, kept as strings so inputs never fight the user. */
export interface Draft {
  market: string;
  maker: string;
  agreement: string;
  loan: string;
  options: string;
  strikePremiumPct: string;
  retainer: string;
  makerCollateral: string;
  bond: string;
  termHours: string;
  noticeMinutes: string;
  exerciseMinutes: string;
  maxSpreadBps: string;
  volatileSpreadBps: string;
  volatilityTriggerBps: string;
  depthBandPct: string;
  minBidDepth: string;
  minAskDepth: string;
  uptimePct: string;
  epochMinutes: string;
  sustainedEpochs: string;
  graceBlocks: string;
  minQuoteLifeBlocks: string;
  maxCreditBlocks: string;
  priceBandPct: string;
  maxRefStepBps: string;
  maxNetSell: string;
  sellWindowHours: string;
  penaltyPct: string;
  slashPct: string;
  watchBounty: string;
  clawbackBounty: string;
  backstopLockMinutes: string;
}

const minutes = (blocks: number) => String(Math.round(blocks / BLOCKS_PER_MINUTE));
const hours = (blocks: number) => String(Math.round((blocks / BLOCKS_PER_MINUTE / 60) * 100) / 100);

export function draftFromPreset(p: Preset, market: string, maker = "", agreement = ""): Draft {
  return {
    market,
    maker,
    agreement,
    loan: String(p.loan),
    options: String(p.options),
    strikePremiumPct: String(p.strikePremiumBps / 100),
    retainer: String(p.retainer),
    makerCollateral: String(p.makerCollateral),
    bond: String(p.bond),
    termHours: hours(p.termBlocks),
    noticeMinutes: minutes(p.noticeBlocks),
    exerciseMinutes: minutes(p.exerciseWindowBlocks),
    maxSpreadBps: String(p.ob.maxSpreadBps),
    volatileSpreadBps: String(p.ob.volatileSpreadBps),
    volatilityTriggerBps: String(p.ob.volatilityTriggerBps),
    depthBandPct: String(p.ob.depthBandBps / 100),
    minBidDepth: String(p.ob.minBidDepth),
    minAskDepth: String(p.ob.minAskDepth),
    uptimePct: String(p.ob.uptimeTargetBps / 100),
    epochMinutes: minutes(p.ob.epochBlocks),
    sustainedEpochs: String(p.ob.sustainedBreachEpochs),
    graceBlocks: String(p.ob.graceBlocks),
    minQuoteLifeBlocks: String(p.ob.minQuoteLifeBlocks),
    maxCreditBlocks: String(p.ob.maxCreditBlocks),
    priceBandPct: String(p.risk.priceBandBps / 100),
    maxRefStepBps: String(p.risk.maxRefStepBps),
    maxNetSell: String(p.risk.maxNetSell),
    sellWindowHours: hours(p.risk.sellWindowBlocks),
    penaltyPct: String(p.risk.penaltyBps / 100),
    slashPct: String(p.risk.breachSlashBps / 100),
    watchBounty: String(p.risk.watchBounty),
    clawbackBounty: String(p.risk.clawbackBounty),
    backstopLockMinutes: minutes(p.risk.backstopLockBlocks),
  };
}

export type Issues = Partial<Record<keyof Draft, string>>;

export interface Built {
  terms: {
    market: Address;
    maker: Address;
    loan: bigint;
    makerCollateral: bigint;
    bond: bigint;
    options: bigint;
    retainer: bigint;
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
      minBidDepth: bigint;
      minAskDepth: bigint;
    };
    risk: {
      priceBandBps: number;
      maxRefStepBps: number;
      penaltyBps: number;
      breachSlashBps: number;
      sellWindowBlocks: number;
      backstopLockBlocks: number;
      maxNetSell: bigint;
      watchBounty: bigint;
      clawbackBounty: bigint;
      priceSource: Address;
      maxPriceAge: number;
    };
    termsHash: `0x${string}`;
  };
  errors: Issues;
  warnings: string[];
}

const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));
const bps = (pct: string) => Math.round(num(pct) * 100);
const blocksFromMinutes = (m: string) => Math.round(num(m) * BLOCKS_PER_MINUTE);
const blocksFromHours = (h: string) => Math.round(num(h) * 60 * BLOCKS_PER_MINUTE);

function amount(value: string, decimals: number): bigint {
  try {
    return parseUnits(value.trim() === "" ? "0" : value.trim(), decimals);
  } catch {
    return -1n;
  }
}

/**
 * Converts the draft into the escrow's Terms struct and checks it. Errors mirror what the contract would reject;
 * warnings flag terms that are legal but would make the agreement hard to honour.
 */
export function build(d: Draft, market: MarketInfo | undefined, mid: bigint | undefined): Built {
  const errors: Issues = {};
  const warnings: string[] = [];
  const baseDecimals = market?.baseDecimals ?? 18;
  const quoteDecimals = market?.quoteDecimals ?? 6;
  const base = (v: string) => amount(v, baseDecimals);
  const quote = (v: string) => amount(v, quoteDecimals);

  if (!isAddress(d.maker)) errors.maker = "Enter the market maker’s address";
  if (!isAddress(d.market)) errors.market = "Choose a Kuru market";

  const loan = base(d.loan);
  const options = base(d.options);
  if (loan <= 0n) errors.loan = "The loan must be more than zero";
  if (options < 0n) errors.options = "Not a number";
  else if (options > loan) errors.options = "Options cannot exceed the loan";

  const premium = num(d.strikePremiumPct);
  if (Number.isNaN(premium) || premium < -50)
    errors.strikePremiumPct = "Enter a premium over the current mid";
  const tick = market?.tickSize ?? 1n;
  const strike = mid ? ((mid * BigInt(Math.round((100 + premium) * 100))) / 10_000n / tick) * tick : 0n;

  const termBlocks = blocksFromHours(d.termHours);
  const epochBlocks = blocksFromMinutes(d.epochMinutes);
  if (!(termBlocks > 0)) errors.termHours = "The term must be positive";
  if (!(epochBlocks > 0)) errors.epochMinutes = "Epochs must be positive";
  else if (epochBlocks > termBlocks) errors.epochMinutes = "An epoch cannot be longer than the term";

  const uptime = bps(d.uptimePct);
  if (!(uptime > 0 && uptime <= 10_000)) errors.uptimePct = "Between 0 and 100%";
  const maxSpread = Math.round(num(d.maxSpreadBps));
  const volatileSpread = Math.round(num(d.volatileSpreadBps));
  if (!(maxSpread > 0)) errors.maxSpreadBps = "Must be positive";
  if (!(volatileSpread >= maxSpread)) errors.volatileSpreadBps = "Cannot be tighter than the normal spread";
  const depthBand = bps(d.depthBandPct);
  if (!(depthBand > 0)) errors.depthBandPct = "Must be positive";
  const priceBand = bps(d.priceBandPct);
  if (!(priceBand > 0)) errors.priceBandPct = "Must be positive";
  const sustained = Math.round(num(d.sustainedEpochs));
  if (!(sustained > 0)) errors.sustainedEpochs = "At least one epoch";
  const slash = bps(d.slashPct);
  if (!(slash >= 0 && slash <= 10_000)) errors.slashPct = "Between 0 and 100%";
  const sellWindow = blocksFromHours(d.sellWindowHours);
  if (!(sellWindow > 0)) errors.sellWindowHours = "Must be positive";
  const maxCredit = Math.round(num(d.maxCreditBlocks));
  if (!(maxCredit > 0)) errors.maxCreditBlocks = "Must be positive";

  for (const key of [
    "retainer",
    "makerCollateral",
    "bond",
    "minBidDepth",
    "minAskDepth",
    "watchBounty",
    "clawbackBounty",
  ] as const) {
    if (quote(d[key]) < 0n) errors[key] = "Not a number";
  }
  if (base(d.maxNetSell) < 0n) errors.maxNetSell = "Not a number";

  const minBid = quote(d.minBidDepth);
  const minAsk = quote(d.minAskDepth);
  const maxNetSell = base(d.maxNetSell);
  if (priceBand < depthBand)
    warnings.push(
      "The quote price band is narrower than the depth band, so some counted depth can never be quoted.",
    );
  if (mid && market && maxNetSell >= 0n) {
    const askBase =
      (minAsk * market.sizePrecision * market.baseSizeMultiplier * market.pricePrecision) /
      (mid * 10n ** BigInt(quoteDecimals));
    if (maxNetSell < askBase)
      warnings.push(
        "The sell limit is below the ask depth required, so the maker cannot rest enough asks to comply.",
      );
  }
  if (quote(d.makerCollateral) < (minBid * 12n) / 10n)
    warnings.push("Maker collateral leaves little room above the required bid depth once fills start.");
  if (uptime > 9_900) warnings.push("Above 99% uptime leaves almost no room for a single slow observation.");
  if (quote(d.bond) < quote(d.clawbackBounty) + quote(d.watchBounty) * BigInt(Math.max(1, sustained))) {
    warnings.push("The bond may not cover the bounties a breach pays out, so enforcement could go unpaid.");
  }

  const termsHash = d.agreement.trim() ? keccak256(toBytes(d.agreement.trim())) : zeroHash;

  return {
    errors,
    warnings,
    terms: {
      market: (isAddress(d.market) ? d.market : zeroAddress) as Address,
      maker: (isAddress(d.maker) ? d.maker : zeroAddress) as Address,
      loan: loan > 0n ? loan : 0n,
      makerCollateral: quote(d.makerCollateral) > 0n ? quote(d.makerCollateral) : 0n,
      bond: quote(d.bond) > 0n ? quote(d.bond) : 0n,
      options: options > 0n ? options : 0n,
      retainer: quote(d.retainer) > 0n ? quote(d.retainer) : 0n,
      strike: Number(strike),
      initialPrice: Number(mid ?? 0n),
      termBlocks,
      noticeBlocks: blocksFromMinutes(d.noticeMinutes),
      exerciseWindowBlocks: blocksFromMinutes(d.exerciseMinutes),
      ob: {
        maxSpreadBps: maxSpread,
        depthBandBps: depthBand,
        uptimeTargetBps: uptime,
        sustainedBreachEpochs: sustained,
        volatileSpreadBps: volatileSpread,
        volatilityTriggerBps: Math.round(num(d.volatilityTriggerBps)),
        epochBlocks,
        maxCreditBlocks: maxCredit,
        minQuoteLifeBlocks: Math.round(num(d.minQuoteLifeBlocks)),
        graceBlocks: Math.round(num(d.graceBlocks)),
        minBidDepth: minBid > 0n ? minBid : 0n,
        minAskDepth: minAsk > 0n ? minAsk : 0n,
      },
      risk: {
        priceBandBps: priceBand,
        maxRefStepBps: Math.round(num(d.maxRefStepBps)),
        penaltyBps: bps(d.penaltyPct),
        breachSlashBps: slash,
        sellWindowBlocks: sellWindow,
        backstopLockBlocks: blocksFromMinutes(d.backstopLockMinutes),
        maxNetSell: maxNetSell > 0n ? maxNetSell : 0n,
        watchBounty: quote(d.watchBounty) > 0n ? quote(d.watchBounty) : 0n,
        clawbackBounty: quote(d.clawbackBounty) > 0n ? quote(d.clawbackBounty) : 0n,
        priceSource: zeroAddress,
        maxPriceAge: 0,
      },
      termsHash,
    },
  };
}
