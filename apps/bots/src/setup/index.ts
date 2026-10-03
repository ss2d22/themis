import {
  covenantAbi,
  EMPTY_ASK,
  EMPTY_BID,
  kuruAccountCoreAbi,
  kuruOrderBookAbi,
  kuruTestnet,
  type MarketUnits,
  outcomeMarketAbi,
  type PresetName,
  presets,
  readMarketUnits,
  Template,
} from "@covenant/sdk";
import {
  type Address,
  createTestClient,
  createWalletClient,
  erc20Abi,
  http,
  keccak256,
  maxUint256,
  parseEther,
  parseUnits,
  toHex,
  zeroAddress,
} from "viem";
import { chainFor, publicClientFor, send, walletFor } from "../chain.js";
import { type Config, required } from "../config.js";
import type { Logger } from "../log.js";

type Client = ReturnType<typeof publicClientFor>;
type Wallet = ReturnType<typeof walletFor>;

async function approve(client: Client, wallet: Wallet, token: Address, spender: Address) {
  const allowance = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [wallet.account.address, spender],
  });
  if (allowance > 2n ** 128n) return;
  const r = await send(client, wallet, {
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
  });
  if (!r.ok) throw new Error(`approve failed: ${r.reason}`);
}

async function decimals(client: Client, token: Address) {
  return client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
}

function buildTerms(name: PresetName, u: MarketUnits, baseDecimals: number, mid: bigint, maker: Address) {
  const p = presets[name];
  const base = (x: number) => parseUnits(String(x), baseDecimals);
  const quote = (x: number) => parseUnits(String(x), u.quoteDecimals);
  const loan = p.template === Template.Buyback ? quote(p.loan) : base(p.loan);
  const strike = ((mid * BigInt(10_000 + p.strikePremiumBps)) / 10_000n / u.tickSize) * u.tickSize;
  return {
    market: u.market,
    maker,
    loan,
    makerCollateral: quote(p.makerCollateral),
    bond: quote(p.bond),
    options: base(p.options),
    retainer: quote(p.retainer),
    strike: Number(strike),
    initialPrice: Number(mid),
    termBlocks: p.termBlocks,
    noticeBlocks: p.noticeBlocks,
    exerciseWindowBlocks: p.exerciseWindowBlocks,
    ob: { ...p.ob, minBidDepth: quote(p.ob.minBidDepth), minAskDepth: quote(p.ob.minAskDepth) },
    risk: {
      ...p.risk,
      maxNetSell: base(p.risk.maxNetSell),
      watchBounty: quote(p.risk.watchBounty),
      clawbackBounty: quote(p.risk.clawbackBounty),
      priceSource: zeroAddress,
      maxPriceAge: 0,
    },
    termsHash: keccak256(toHex(`covenant:${name}:${u.market}:${mid}`)),
    template: p.template,
  } as const;
}

/** Issuer proposes from a preset, the market maker accepts and commits to a refresh policy. */
export async function setupEngagement(
  config: Config,
  log: Logger,
  preset: PresetName,
  adversary: boolean,
  pending = false,
) {
  const client = publicClientFor(config.RPC_URL);
  const covenant = required(config, "COVENANT_ADDRESS");
  const issuer = walletFor(config.RPC_URL, required(config, "ISSUER_KEY"));
  const maker = walletFor(config.RPC_URL, required(config, adversary ? "ADVERSARY_MAKER_KEY" : "MAKER_KEY"));
  const operator = walletFor(
    config.RPC_URL,
    required(config, adversary ? "ADVERSARY_OPERATOR_KEY" : "OPERATOR_KEY"),
  );

  const u = await readMarketUnits(client, config.KURU_MARKET);
  const [bid, ask] = await client.readContract({
    address: u.market,
    abi: kuruOrderBookAbi,
    functionName: "bestBidAsk",
  });
  if (BigInt(bid) === EMPTY_BID || BigInt(ask) === EMPTY_ASK)
    throw new Error("market has no two-sided book to price from");
  const mid = ((BigInt(bid) + BigInt(ask)) / 2n / u.tickSize) * u.tickSize;
  const terms = buildTerms(preset, u, await decimals(client, u.base), mid, maker.account.address);

  await approve(client, issuer, u.base, covenant);
  await approve(client, issuer, u.quote, covenant);
  await approve(client, maker, u.quote, covenant);

  const proposal = await send(client, issuer, {
    address: covenant,
    abi: covenantAbi,
    functionName: "propose",
    args: [terms],
  });
  if (!proposal.ok) throw new Error(`propose failed: ${proposal.reason}`);
  const id = await client.readContract({
    address: covenant,
    abi: covenantAbi,
    functionName: "engagementCount",
  });
  if (pending) {
    log.info(
      { id: id.toString(), preset, propose: proposal.hash },
      "engagement proposed, awaiting acceptance",
    );
    return id;
  }

  const accepted = await send(client, maker, {
    address: covenant,
    abi: covenantAbi,
    functionName: "accept",
    args: [id, operator.account.address],
  });
  if (!accepted.ok) throw new Error(`accept failed: ${accepted.reason}`);

  if (!adversary) {
    await send(client, maker, {
      address: covenant,
      abi: covenantAbi,
      functionName: "setRefreshPolicy",
      args: [id, true, 10],
    });
  }
  log.info(
    {
      id: id.toString(),
      preset,
      adversary,
      mid: mid.toString(),
      propose: proposal.hash,
      accept: accepted.hash,
    },
    "engagement opened",
  );
  return id;
}

/** Deposits the taker's tokens into its own Kuru root account. */
export async function setupTaker(config: Config, log: Logger, baseAmount: number, quoteAmount: number) {
  const client = publicClientFor(config.RPC_URL);
  const taker = walletFor(config.RPC_URL, required(config, "TAKER_KEY"));
  const u = await readMarketUnits(client, config.KURU_MARKET);
  const core = kuruTestnet.accountCore;

  for (const [token, amount] of [
    [u.base, parseUnits(String(baseAmount), await decimals(client, u.base))],
    [u.quote, parseUnits(String(quoteAmount), u.quoteDecimals)],
  ] as const) {
    if (amount === 0n) continue;
    await approve(client, taker, token, core);
    const r = await send(client, taker, {
      address: core,
      abi: kuruAccountCoreAbi,
      functionName: "deposit",
      args: [taker.account.address, token, amount],
    });
    log.info(
      { token, amount: amount.toString(), ok: r.ok, ...(r.ok ? {} : { reason: r.reason }) },
      "taker deposit",
    );
  }
}

export async function setupOutcome(
  config: Config,
  log: Logger,
  id: bigint,
  firstEpoch: number,
  epochCount: number,
) {
  const client = publicClientFor(config.RPC_URL);
  const wallet = walletFor(config.RPC_URL, required(config, "ISSUER_KEY"));
  const outcomes = required(config, "OUTCOME_MARKET_ADDRESS");
  const r = await send(client, wallet, {
    address: outcomes,
    abi: outcomeMarketAbi,
    functionName: "create",
    args: [id, firstEpoch, epochCount],
  });
  log.info(
    {
      id: id.toString(),
      firstEpoch,
      epochCount,
      ok: r.ok,
      ...(r.ok ? { tx: r.hash } : { reason: r.reason }),
    },
    "outcome market",
  );
}

/** Local anvil fork only: mints test tokens as Kuru governance and tops up gas for every role. */
export async function fundFork(config: Config, log: Logger) {
  const chain = chainFor(config.RPC_URL);
  const transport = http(config.RPC_URL);
  const anvil = createTestClient({ mode: "anvil", chain, transport });
  const client = publicClientFor(config.RPC_URL);
  const governance = createWalletClient({ account: KURU_GOVERNANCE, chain, transport });

  const keys = [
    "ISSUER_KEY",
    "MAKER_KEY",
    "OPERATOR_KEY",
    "ADVERSARY_MAKER_KEY",
    "ADVERSARY_OPERATOR_KEY",
    "TAKER_KEY",
    "WATCHER_KEY",
  ] as const;
  const roles = keys.flatMap((key) => {
    const value = config[key];
    return value ? [walletFor(config.RPC_URL, value).account.address] : [];
  });

  await anvil.impersonateAccount({ address: KURU_GOVERNANCE });
  await anvil.setBalance({ address: KURU_GOVERNANCE, value: parseEther("100") });

  for (const address of roles) {
    await anvil.setBalance({ address, value: parseEther("1000") });
    for (const [token, amount] of [
      [kuruTestnet.tokens.WETH, parseUnits("50", 18)],
      [kuruTestnet.tokens.USDC, parseUnits("200000", 6)],
    ] as const) {
      const hash = await governance.writeContract({
        address: token,
        abi: mintableAbi,
        functionName: "mint",
        args: [address, amount],
      });
      await client.waitForTransactionReceipt({ hash });
    }
    log.info({ address }, "funded");
  }
  await anvil.stopImpersonatingAccount({ address: KURU_GOVERNANCE });
}

const KURU_GOVERNANCE: Address = "0xc64346f7dDc776B34EAa44C0B61D564797038143";

const mintableAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
