import { covenantAbi, outcomeMarketAbi } from "@covenant/sdk";
import type { Address } from "viem";
import { publicClientFor, recover, send, walletFor } from "../chain.js";
import { type Config, required } from "../config.js";
import { CovenantReader, Status } from "../covenant.js";
import type { Logger } from "../log.js";
import { sleep } from "../time.js";

const OutcomeOpen = 0;

/**
 * Enforces every engagement on the escrow: reports breaches once they outlast the grace period, closes
 * finished epochs, claws back engagements that fail too many in a row, settles matured ones and resolves
 * outcome markets. All of it is permissionless and paid from the market maker's bond.
 */
export async function runWatchtower(config: Config, log: Logger, intervalMs = 2_000) {
  const client = publicClientFor(config.RPC_URL);
  const wallet = walletFor(config.RPC_URL, required(config, "WATCHER_KEY"));
  const covenant = required(config, "COVENANT_ADDRESS");
  const outcomes = config.OUTCOME_MARKET_ADDRESS;
  const reader = new CovenantReader(client, covenant);

  log.info({ covenant, outcomes, watcher: wallet.account.address }, "watchtower started");

  for (;;) {
    try {
      const [block, count] = await Promise.all([client.getBlockNumber(), reader.count()]);

      for (let id = 1n; id <= count; id++) {
        const e = await reader.engagement(id);

        if (e.status === Status.ClawbackEligible) {
          const r = await send(client, wallet, {
            address: covenant,
            abi: covenantAbi,
            functionName: "clawback",
            args: [id],
          });
          log.info(
            { id: id.toString(), ok: r.ok, ...(r.ok ? { tx: r.hash } : { reason: r.reason }) },
            "clawback",
          );
          continue;
        }
        if (e.status !== Status.Active) continue;

        if (block >= e.endBlock + BigInt(e.terms.exerciseWindowBlocks)) {
          const r = await send(client, wallet, {
            address: covenant,
            abi: covenantAbi,
            functionName: "settle",
            args: [id, 0n],
          });
          log.info(
            { id: id.toString(), ok: r.ok, ...(r.ok ? { tx: r.hash } : { reason: r.reason }) },
            "settle",
          );
          continue;
        }

        const [from, to] = await client.readContract({
          address: covenant,
          abi: covenantAbi,
          functionName: "epochBounds",
          args: [id, e.nextEpoch],
        });
        if (from < e.endBlock && block >= to) {
          const r = await send(client, wallet, {
            address: covenant,
            abi: covenantAbi,
            functionName: "closeEpoch",
            args: [id],
          });
          log.info(
            {
              id: id.toString(),
              epoch: e.nextEpoch,
              ok: r.ok,
              ...(r.ok ? { tx: r.hash } : { reason: r.reason }),
            },
            "epoch closed",
          );
          continue;
        }

        const m = await reader.metrics(id);
        if (m.compliant) continue;
        const startsClock = e.lastCompliant;
        const graceOver =
          !e.breachReported &&
          e.nonCompliantSince !== 0n &&
          block >= e.nonCompliantSince + BigInt(e.terms.ob.graceBlocks);
        if (startsClock || graceOver) {
          const r = await send(client, wallet, {
            address: covenant,
            abi: covenantAbi,
            functionName: "poke",
            args: [id],
          });
          log.info(
            {
              id: id.toString(),
              report: graceOver ? "breach" : "dip",
              ok: r.ok,
              ...(r.ok ? { tx: r.hash } : { reason: r.reason }),
            },
            "poke",
          );
        }
      }

      if (outcomes) await resolveOutcomes(client, wallet, outcomes, covenant, block, log);
      await sleep(intervalMs);
    } catch (error) {
      await recover(log, error);
    }
  }
}

async function resolveOutcomes(
  client: ReturnType<typeof publicClientFor>,
  wallet: ReturnType<typeof walletFor>,
  outcomes: Address,
  covenant: Address,
  block: bigint,
  log: Logger,
) {
  const count = await client.readContract({
    address: outcomes,
    abi: outcomeMarketAbi,
    functionName: "marketCount",
  });
  for (let marketId = 1n; marketId <= count; marketId++) {
    const m = await client.readContract({
      address: outcomes,
      abi: outcomeMarketAbi,
      functionName: "market",
      args: [marketId],
    });
    if (m.outcome !== OutcomeOpen) continue;
    const [, to] = await client.readContract({
      address: covenant,
      abi: covenantAbi,
      functionName: "epochBounds",
      args: [m.engagementId, m.firstEpoch + m.epochCount - 1],
    });
    if (block < to) continue;
    const r = await send(client, wallet, {
      address: outcomes,
      abi: outcomeMarketAbi,
      functionName: "resolve",
      args: [marketId],
    });
    log.info(
      { market: marketId.toString(), ok: r.ok, ...(r.ok ? { tx: r.hash } : { reason: r.reason }) },
      "outcome resolved",
    );
  }
}
