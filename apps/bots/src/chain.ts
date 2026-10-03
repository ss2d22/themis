import { errorNameIn, kuruErrorName } from "@covenant/sdk";
import {
  type Abi,
  BaseError,
  type Chain,
  type ContractFunctionArgs,
  type ContractFunctionName,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { nonceManager, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

export function chainFor(rpcUrl: string): Chain {
  return { ...monadTestnet, rpcUrls: { default: { http: [rpcUrl] } } };
}

export function publicClientFor(rpcUrl: string): PublicClient {
  return createPublicClient({
    chain: chainFor(rpcUrl),
    transport: http(rpcUrl, { batch: true, retryCount: 3 }),
    pollingInterval: 400,
  });
}

export function walletFor(rpcUrl: string, key: Hex) {
  const account = privateKeyToAccount(key, { nonceManager });
  return createWalletClient({ account, chain: chainFor(rpcUrl), transport: http(rpcUrl, { retryCount: 3 }) });
}

export type Wallet = ReturnType<typeof walletFor>;

const GAS_MARGIN_PERCENT = 125n;

export type SendResult =
  | { ok: true; hash: Hex; receipt: TransactionReceipt }
  | { ok: false; reason: string; args?: readonly unknown[]; hash?: Hex };

/**
 * Simulates a call and only sends it if it would succeed. Monad charges the full gas limit even for
 * reverted transactions, so failing in simulation is the cheap path.
 */
export async function send<
  const abi extends Abi,
  name extends ContractFunctionName<abi, "nonpayable" | "payable">,
  args extends ContractFunctionArgs<abi, "nonpayable" | "payable", name>,
>(
  client: PublicClient,
  wallet: Wallet,
  call: { address: Hex; abi: abi; functionName: name; args: args },
): Promise<SendResult> {
  try {
    const { request } = await client.simulateContract({ ...call, account: wallet.account } as never);
    // The estimate is taken against the pre-block state; other transactions in the same block can warm or move
    // state and push the real cost past it. Monad charges the full limit, so the margin is kept modest.
    const estimate = await client.estimateContractGas({ ...call, account: wallet.account } as never);
    const gas = (estimate * GAS_MARGIN_PERCENT) / 100n;
    const hash = await wallet.writeContract({ ...(request as object), gas } as never);
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return { ok: false, reason: `reverted on chain using ${receipt.gasUsed} of ${gas} gas`, hash };
    }
    return { ok: true, hash, receipt };
  } catch (error) {
    return { ok: false, ...describeRevert(error) };
  }
}

export function describeRevert(error: unknown): { reason: string; args?: readonly unknown[] } {
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? kuruErrorName(revert.raw) ?? errorNameIn(revert.message);
      return { reason: name ?? revert.shortMessage, args: revert.data?.args };
    }
    return { reason: errorNameIn(error.message) ?? error.shortMessage };
  }
  return { reason: String(error) };
}

/**
 * Logs a failed loop iteration and waits before the next one. RPC timeouts and dropped connections are routine
 * over days of running; a bot should ride them out rather than exit.
 */
export async function recover(
  log: { warn: (fields: object, message: string) => void },
  error: unknown,
  waitMs = 3_000,
) {
  log.warn({ reason: describeRevert(error).reason }, "iteration failed, retrying");
  await new Promise((resolve) => setTimeout(resolve, waitMs + Math.random() * waitMs));
}
