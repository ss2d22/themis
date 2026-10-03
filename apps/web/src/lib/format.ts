import { BLOCK_SECONDS } from "./env";

type Big = bigint | string | number;

const big = (value: Big) => (typeof value === "bigint" ? value : BigInt(value));

/** Fixed-point atoms to a grouped decimal string. */
export function units(value: Big, decimals: number, fraction = 2): string {
  const v = big(value);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  let frac = "";
  if (fraction > 0) {
    const rounded = (abs % scale) * 10n ** BigInt(fraction) + scale / 2n;
    const digits = rounded / scale;
    if (digits >= 10n ** BigInt(fraction))
      return units((negative ? -1n : 1n) * (whole + 1n) * scale, decimals, fraction);
    frac = `.${digits.toString().padStart(fraction, "0")}`;
  }
  return `${negative ? "−" : ""}${whole.toLocaleString("en-US")}${frac}`;
}

/** Compact form for wide ranges: 12.4k, 3.1M. */
export function compact(value: number, fraction = 1): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(fraction)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(fraction)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(fraction)}k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function toNumber(value: Big, decimals: number): number {
  return Number(big(value)) / 10 ** decimals;
}

export function bps(value: number, fraction = 0): string {
  return `${value.toFixed(fraction)} bps`;
}

export function percentFromBps(value: number, fraction = 1): string {
  return `${(value / 100).toFixed(fraction)}%`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

/** Blocks to a human duration at Monad's 400ms block time. */
export function blocksToDuration(blocks: Big): string {
  return duration(Number(big(blocks)) * BLOCK_SECONDS);
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3_600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3_600);
    const m = Math.round((seconds % 3_600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86_400);
  const h = Math.round((seconds % 86_400) / 3_600);
  return h ? `${d}d ${h}h` : `${d}d`;
}

export function timeAgo(unixSeconds: Big, now = Date.now() / 1000): string {
  const delta = now - Number(big(unixSeconds));
  if (delta < 5) return "now";
  return `${duration(delta)} ago`;
}

export function clock(unixSeconds: Big): string {
  return new Date(Number(big(unixSeconds)) * 1000).toLocaleTimeString("en-GB", { hour12: false });
}
