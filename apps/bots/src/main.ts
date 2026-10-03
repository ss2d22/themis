import { parseArgs } from "node:util";
import type { PresetName } from "@covenant/sdk";
import { runAdversary } from "./bots/adversary.js";
import { defaultMarketMaker, runMarketMaker } from "./bots/market-maker.js";
import { runTaker } from "./bots/taker.js";
import { runWatchtower } from "./bots/watchtower.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./log.js";
import { fundFork, setupEngagement, setupOutcome, setupTaker } from "./setup/index.js";

const usage = `usage: pnpm start <command> [options]

  mm                          run the honest market maker
  adversary [--onchain]       run the attacking market maker
  taker                       run random taker flow
  watchtower                  enforce every engagement for bounties

  setup engagement [--preset launch|exchangeGrade|demo] [--adversary] [--pending]
  setup taker [--base 1] [--quote 3000]
  setup outcome --engagement <id> --first <epoch> --count <n>
  setup fund-fork             local anvil fork only

  --engagement <id>           overrides ENGAGEMENT_ID
  --size <base>               market maker size per level`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      engagement: { type: "string" },
      preset: { type: "string", default: "launch" },
      adversary: { type: "boolean", default: false },
      pending: { type: "boolean", default: false },
      onchain: { type: "boolean", default: false },
      base: { type: "string", default: "1" },
      quote: { type: "string", default: "3000" },
      first: { type: "string", default: "0" },
      count: { type: "string", default: "1" },
      size: { type: "string" },
    },
  });
  const [command, sub] = positionals;
  const config = loadConfig();
  if (values.engagement) config.ENGAGEMENT_ID = BigInt(values.engagement);
  const log = createLogger(config.LOG_FILE, sub ? `${command}:${sub}` : (command ?? "bots"));

  switch (command) {
    case "mm":
      return runMarketMaker(config, log, {
        ...defaultMarketMaker,
        ...(values.size ? { sizePerLevel: Number(values.size) } : {}),
      });
    case "adversary":
      return runAdversary(config, log, values.onchain);
    case "taker":
      return runTaker(config, log);
    case "watchtower":
      return runWatchtower(config, log);
    case "setup":
      switch (sub) {
        case "engagement":
          return void (await setupEngagement(
            config,
            log,
            values.preset as PresetName,
            values.adversary,
            values.pending,
          ));
        case "taker":
          return setupTaker(config, log, Number(values.base), Number(values.quote));
        case "outcome":
          return setupOutcome(
            config,
            log,
            BigInt(values.engagement ?? 0),
            Number(values.first),
            Number(values.count),
          );
        case "fund-fork":
          return fundFork(config, log);
      }
  }
  console.error(usage);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
