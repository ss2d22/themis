import type { Address, Hex } from "viem";
import { z } from "zod";

const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "expected an address")
  .transform((v) => v as Address);
const privateKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "expected a 32-byte hex private key")
  .transform((v) => v as Hex);

const schema = z.object({
  RPC_URL: z.url().default("https://testnet-rpc.monad.xyz"),
  COVENANT_ADDRESS: address.optional(),
  OUTCOME_MARKET_ADDRESS: address.optional(),
  KURU_MARKET: address.default("0x9d187971B64505Ac81f12c5FD2ac9c5247Ec62F3"),
  ISSUER_KEY: privateKey.optional(),
  MAKER_KEY: privateKey.optional(),
  OPERATOR_KEY: privateKey.optional(),
  ADVERSARY_MAKER_KEY: privateKey.optional(),
  ADVERSARY_OPERATOR_KEY: privateKey.optional(),
  TAKER_KEY: privateKey.optional(),
  WATCHER_KEY: privateKey.optional(),
  ENGAGEMENT_ID: z.coerce.bigint().optional(),
  LOG_FILE: z.string().default("logs/bots.ndjson"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env file; rely on the environment
  }
  return schema.parse(process.env);
}

export function required<K extends keyof Config>(config: Config, key: K): NonNullable<Config[K]> {
  const value = config[key];
  if (value === undefined || value === null || value === "") throw new Error(`${String(key)} is not set`);
  return value as NonNullable<Config[K]>;
}
