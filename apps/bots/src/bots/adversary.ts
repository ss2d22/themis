import { covenantAbi, encodeCancel, encodeOps, encodeQuote, readMarketUnits, toRawSize } from "@covenant/sdk";
import { type Hex, numberToHex } from "viem";
import { describeRevert, publicClientFor, recover, send, walletFor } from "../chain.js";
import { type Config, required } from "../config.js";
import { CovenantReader, Status } from "../covenant.js";
import type { Logger } from "../log.js";
import { sleep } from "../time.js";

interface Attempt {
  name: string;
  ops: Hex[];
}

/** Raw packed word with arbitrary flags, for orders the escrow is expected to refuse. */
function rawOp(slot: number, flags: number, price: bigint, size: bigint, minSizeAfterBlock = 0n): Hex {
  const word =
    BigInt(slot) | (BigInt(flags) << 8n) | (price << 16n) | (size << 48n) | (minSizeAfterBlock << 144n);
  return numberToHex(word, { size: 32 });
}

/**
 * Plays a market maker that tries every trick the escrow is meant to stop, then walks away from its
 * obligations so watchtowers can claw the loan back. Set `onchain` to land the rejected attempts as
 * reverted transactions for the record.
 */
export async function runAdversary(config: Config, log: Logger, onchain: boolean) {
  const client = publicClientFor(config.RPC_URL);
  const wallet = walletFor(config.RPC_URL, required(config, "ADVERSARY_OPERATOR_KEY"));
  const covenant = required(config, "COVENANT_ADDRESS");
  const id = required(config, "ENGAGEMENT_ID");
  const reader = new CovenantReader(client, covenant);

  const e = await reader.engagement(id);
  const units = await readMarketUnits(client, e.terms.market);
  const ref = BigInt(e.refPrice);
  const tick = units.tickSize;
  const lot = toRawSize(0.01, units);
  log.info({ id: id.toString(), ref: ref.toString() }, "adversary started");

  const thin = encodeOps([
    encodeQuote({ slot: 0, side: "buy", price: ((ref * 9_990n) / 10_000n / tick) * tick, size: lot }),
    encodeQuote({ slot: 32, side: "sell", price: ((ref * 10_010n) / 10_000n / tick + 1n) * tick, size: lot }),
  ]);
  const thinResult = await send(client, wallet, {
    address: covenant,
    abi: covenantAbi,
    functionName: "quote",
    args: [id, thin],
  });
  log.info({ phase: "thin-quotes", ok: thinResult.ok }, "quoting a token amount, far below the depth target");
  await sleep(2_000);

  const block = await client.getBlockNumber();
  const loanSize = e.terms.loan / units.baseSizeMultiplier;
  const attempts: Attempt[] = [
    { name: "market-sell", ops: [rawOp(40, 0, (ref * 9_000n) / 10_000n, loanSize / 4n)] },
    { name: "reduce-after-block", ops: [rawOp(41, 8, ref + 100n * tick, lot * 100n, block + 5n)] },
    {
      name: "cheap-ask-to-own-wallet",
      ops: [encodeQuote({ slot: 42, side: "sell", price: (ref * 8_000n) / 10_000n, size: loanSize / 4n })],
    },
    {
      name: "dump-whole-loan",
      ops: [encodeQuote({ slot: 43, side: "sell", price: ref + 200n * tick, size: loanSize })],
    },
    {
      name: "spoof-and-cancel",
      ops: [
        encodeQuote({ slot: 44, side: "sell", price: ref + 50n * tick, size: lot * 50n }),
        encodeCancel(44),
      ],
    },
  ];

  for (const attempt of attempts) {
    const call = {
      address: covenant,
      abi: covenantAbi,
      functionName: "quote",
      args: [id, encodeOps(attempt.ops)],
    } as const;
    try {
      await client.simulateContract({ ...call, account: wallet.account });
      log.error({ attempt: attempt.name }, "escrow accepted an attack");
    } catch (error) {
      const { reason, args } = describeRevert(error);
      const fields: Record<string, unknown> = { attempt: attempt.name, reason, args: args?.map(String) };
      if (onchain) {
        const hash = await wallet.writeContract({ ...call, gas: 1_500_000n });
        await client.waitForTransactionReceipt({ hash });
        fields.tx = hash;
      }
      log.info(fields, "attack refused");
    }
    await sleep(1_000);
  }

  await sleep(2_000);
  const vanish = await send(client, wallet, {
    address: covenant,
    abi: covenantAbi,
    functionName: "quote",
    args: [id, encodeOps([encodeCancel(0), encodeCancel(32)])],
  });
  log.info({ phase: "vanish", ok: vanish.ok }, "pulled every quote and stopped quoting");

  let last = -1;
  for (;;) {
    try {
      const now = await reader.engagement(id);
      if (now.status !== last) {
        log.info({ status: now.status, failingStreak: now.failingStreak }, "engagement status");
        last = now.status;
      }
      if (now.status === Status.ClawedBack || now.status === Status.Settled) return;
      await sleep(5_000);
    } catch (error) {
      await recover(log, error);
    }
  }
}
