import { decodeErrorResult, type Hex, keccak256, parseAbi, toBytes } from "viem";
import { covenantAbi } from "./abi/covenantAbi";

/** Kuru Spot V2 errors that can surface through escrow calls. */
export const kuruErrorsAbi = parseAbi([
  "error InsufficientBalance()",
  "error InsufficientLiquidity()",
  "error PostOnlyError()",
  "error PriceError()",
  "error SizeError()",
  "error TickSizeError()",
  "error MarketStateError()",
  "error MarketSizeError()",
  "error Unauthorized()",
  "error SelfTrade()",
  "error SlippageExceeded()",
  "error OrderSlotOccupied()",
  "error DuplicatePackedReplaceSlot()",
  "error InvalidPackedReplaceOp()",
  "error PostFillHookAccessDenied()",
  "error PassiveLiquidityCrossesBook()",
  "error SpotTokenNotEnabled()",
  "error InvalidWithdrawalPrice()",
  "error ZeroAmount()",
]);

/** Name of a Kuru error from raw revert data, if it is one. */
export function kuruErrorName(data: Hex | undefined): string | undefined {
  if (!data || data.length < 10) return undefined;
  try {
    return decodeErrorResult({ abi: kuruErrorsAbi, data }).errorName;
  } catch {
    return undefined;
  }
}

const selectors = new Map(
  [...covenantAbi.filter((item) => item.type === "error"), ...kuruErrorsAbi].map((item) => {
    const signature = `${item.name}(${item.inputs.map((input) => input.type).join(",")})`;
    return [keccak256(toBytes(signature)).slice(0, 10), item.name] as const;
  }),
);

/**
 * Names an escrow or Kuru error found anywhere in a failure message. Errors raised during gas estimation reach
 * callers as raw selectors that the contract ABI was never asked to decode.
 */
export function errorNameIn(message: string): string | undefined {
  for (const match of message.matchAll(/0x[0-9a-fA-F]{8}/g)) {
    const name = selectors.get(match[0].toLowerCase());
    if (name) return name;
  }
  return undefined;
}
