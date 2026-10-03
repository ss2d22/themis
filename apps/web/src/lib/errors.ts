import { errorNameIn, kuruErrorName } from "@covenant/sdk";
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/** A short, human reason for a failed call: the escrow or Kuru error name when there is one. */
export function describeError(error: unknown): string {
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) return "Rejected in wallet";
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      return (
        revert.data?.errorName ??
        kuruErrorName(revert.raw) ??
        errorNameIn(revert.message) ??
        revert.shortMessage
      );
    }
    return errorNameIn(error.message) ?? error.shortMessage;
  }
  return error instanceof Error ? error.message : String(error);
}
