import type { Address, PublicClient } from "viem";
import { kuruOrderBookAbi } from "./abi/index";

export interface MarketUnits {
  market: Address;
  base: Address;
  quote: Address;
  sizePrecision: bigint;
  pricePrecision: bigint;
  tickSize: bigint;
  baseSizeMultiplier: bigint;
  quoteDecimals: number;
}

export async function readMarketUnits(client: PublicClient, market: Address): Promise<MarketUnits> {
  const book = { address: market, abi: kuruOrderBookAbi } as const;
  const [base, quote, sizePrecision, pricePrecision, tickSize, baseSizeMultiplier, quoteDecimals] =
    await Promise.all([
      client.readContract({ ...book, functionName: "baseToken" }),
      client.readContract({ ...book, functionName: "quoteToken" }),
      client.readContract({ ...book, functionName: "sizePrecision" }),
      client.readContract({ ...book, functionName: "pricePrecision" }),
      client.readContract({ ...book, functionName: "tickSize" }),
      client.readContract({ ...book, functionName: "baseSizeMultiplier" }),
      client.readContract({ ...book, functionName: "quoteTokenDecimals" }),
    ]);
  return {
    market,
    base,
    quote,
    sizePrecision,
    pricePrecision: BigInt(pricePrecision),
    tickSize: BigInt(tickSize),
    baseSizeMultiplier,
    quoteDecimals,
  };
}

/** Human price (quote per base) to Kuru price units, rounded down to the tick. */
export function toRawPrice(price: number, u: MarketUnits): bigint {
  const raw = BigInt(Math.floor(price * Number(u.pricePrecision)));
  return (raw / u.tickSize) * u.tickSize;
}

export function fromRawPrice(raw: bigint, u: MarketUnits): number {
  return Number(raw) / Number(u.pricePrecision);
}

/** Human base quantity to Kuru size units. */
export function toRawSize(quantity: number, u: MarketUnits): bigint {
  return BigInt(Math.floor(quantity * Number(u.sizePrecision)));
}

export function fromRawSize(raw: bigint, u: MarketUnits): number {
  return Number(raw) / Number(u.sizePrecision);
}

export function baseAtoms(size: bigint, u: MarketUnits): bigint {
  return size * u.baseSizeMultiplier;
}

/** Raw quote atoms for an order of `size` at `price`, rounded down like Kuru bid reserves. */
export function quoteForSize(size: bigint, price: bigint, u: MarketUnits): bigint {
  return (size * price * 10n ** BigInt(u.quoteDecimals)) / (u.sizePrecision * u.pricePrecision);
}

export function bpsBetween(a: bigint, b: bigint): number {
  const diff = a > b ? a - b : b - a;
  return Number((diff * 10_000n) / b);
}
