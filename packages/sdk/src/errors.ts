import { decodeErrorResult, type Hex, parseAbi } from "viem";

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
