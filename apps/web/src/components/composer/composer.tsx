"use client";

import { covenantAbi, kuruErrorName, kuruTestnet, presets } from "@covenant/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import {
  type Address,
  BaseError,
  ContractFunctionRevertedError,
  erc20Abi,
  maxUint256,
  parseEventLogs,
} from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Loading } from "@/components/ui/states";
import { publicClient, useBook } from "@/lib/chain";
import { env } from "@/lib/env";
import { blocksToDuration, units } from "@/lib/format";
import { useMarket } from "@/lib/markets";
import { DepthPreview } from "./depth-preview";
import { build, type Draft, draftFromPreset, type Issues } from "./model";

type PresetKey = "launch" | "exchangeGrade" | "custom";
const presetOptions = [
  ["launch", "Token launch"],
  ["exchangeGrade", "Exchange grade"],
  ["custom", "Custom"],
] as const;

const markets = Object.entries(kuruTestnet.markets);

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-xs font-semibold text-ink">{title}</h2>
        {note ? <p className="text-xs text-ink-3">{note}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</div>
    </section>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
  error,
  hint,
  wide,
  mono = true,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  wide?: boolean;
  mono?: boolean;
}) {
  return (
    <label className={cn("flex flex-col gap-1", wide && "col-span-2")}>
      <span className="text-xs text-ink-3">{label}</span>
      <span
        className={cn(
          "flex h-7 items-center rounded-sm border bg-bg focus-within:border-accent",
          error ? "border-critical/70" : "border-line-strong",
        )}
      >
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-ink outline-none",
            mono && "num",
          )}
        />
        {unit ? <span className="px-2 text-xs text-ink-3">{unit}</span> : null}
      </span>
      {error ? (
        <span className="text-2xs text-critical">{error}</span>
      ) : hint ? (
        <span className="text-2xs text-ink-4">{hint}</span>
      ) : null}
    </label>
  );
}

function reason(error: unknown) {
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError)
      return revert.data?.errorName ?? kuruErrorName(revert.raw) ?? revert.shortMessage;
    return error.shortMessage;
  }
  return String(error);
}

export function Composer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [preset, setPreset] = useState<PresetKey>("launch");
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromPreset(presets.launch, kuruTestnet.markets["WETH/USDC"]),
  );
  const [step, setStep] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<keyof Draft>>(() => new Set());
  const [attempted, setAttempted] = useState(false);

  const market = useMarket(draft.market).data;
  const book = useBook(draft.market as Address, 40).data;
  const mid = useMemo(() => {
    const bid = book?.bids[0]?.price;
    const ask = book?.asks[0]?.price;
    if (!bid || !ask || !market) return undefined;
    return ((bid + ask) / 2n / market.tickSize) * market.tickSize;
  }, [book, market]);
  const built = useMemo(() => build(draft, market, mid), [draft, market, mid]);
  // Errors appear once a field has been edited, or for every field after a submit attempt.
  const errors: Issues = Object.fromEntries(
    Object.entries(built.errors).filter(([key]) => attempted || touched.has(key as keyof Draft)),
  );
  const hasErrors = Object.keys(built.errors).length > 0 || !mid;

  const allowances = useQuery({
    queryKey: ["composer-allowances", address, market?.base, market?.quote],
    enabled: Boolean(address && market && env.covenant),
    refetchInterval: 4_000,
    queryFn: async () => {
      const owner = address as Address;
      const spender = env.covenant as Address;
      const { base, quote } = market as NonNullable<typeof market>;
      const [baseAllowance, quoteAllowance] = await Promise.all([
        publicClient.readContract({
          address: base,
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner, spender],
        }),
        publicClient.readContract({
          address: quote,
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner, spender],
        }),
      ]);
      return { base: baseAllowance, quote: quoteAllowance };
    },
  });

  const set = (key: keyof Draft) => (value: string) => {
    setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));
    if (key !== "maker" && key !== "agreement") setPreset("custom");
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const choosePreset = (key: PresetKey) => {
    setPreset(key);
    if (key !== "custom") setDraft((d) => draftFromPreset(presets[key], d.market, d.maker, d.agreement));
  };

  const t = built.terms;
  const needBase = allowances.data ? allowances.data.base < t.loan : true;
  const needQuote = t.retainer > 0n && (allowances.data ? allowances.data.quote < t.retainer : true);

  async function send(label: string, request: Parameters<typeof writeContractAsync>[0]) {
    setStep(label);
    const hash = await writeContractAsync(request);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async function submit() {
    setAttempted(true);
    if (!address || !market || !env.covenant || hasErrors) return;
    setFailure(null);
    try {
      for (const [needed, token, label] of [
        [needBase, market.base, `Approving ${market.baseSymbol}`],
        [needQuote, market.quote, `Approving ${market.quoteSymbol}`],
      ] as const) {
        if (!needed) continue;
        const { request } = await publicClient.simulateContract({
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [env.covenant, maxUint256],
          account: address,
        });
        await send(label, request as Parameters<typeof writeContractAsync>[0]);
      }
      const { request } = await publicClient.simulateContract({
        address: env.covenant,
        abi: covenantAbi,
        functionName: "propose",
        args: [t],
        account: address,
      });
      const receipt = await send("Proposing", request as Parameters<typeof writeContractAsync>[0]);
      const [proposed] = parseEventLogs({ abi: covenantAbi, eventName: "Proposed", logs: receipt.logs });
      await queryClient.invalidateQueries();
      if (proposed) router.push(`/c/${proposed.args.id}`);
    } catch (error) {
      setFailure(reason(error));
    } finally {
      setStep(null);
    }
  }

  const base = market?.baseSymbol ?? "base";
  const quote = market?.quoteSymbol ?? "quote";
  const fmtQ = (v: bigint) => (market ? `${units(v, market.quoteDecimals, 0)} ${quote}` : "—");
  const fmtB = (v: bigint) => (market ? `${units(v, market.baseDecimals, 2)} ${base}` : "—");
  const price = (v: number) =>
    market ? (v / Number(market.pricePrecision)).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—";

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-auto bg-line lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:overflow-hidden">
      <Panel>
        <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-4">
          <span className="text-xs text-ink-3">Start from</span>
          <Segmented label="Preset" value={preset} options={presetOptions} onChange={choosePreset} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <Section title="Parties">
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-ink-3">Kuru market</span>
              <select
                value={draft.market}
                onChange={(event) => setDraft((d) => ({ ...d, market: event.target.value }))}
                className="h-7 rounded-sm border border-line-strong bg-bg px-2 text-sm text-ink outline-none focus:border-accent"
              >
                {markets.map(([name, addr]) => (
                  <option key={addr} value={addr}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Market maker address"
              value={draft.maker}
              onChange={set("maker")}
              error={errors.maker}
              wide
              hint="The address that will accept and post collateral"
            />
            <Field
              label="Master agreement"
              value={draft.agreement}
              onChange={set("agreement")}
              wide
              mono={false}
              hint={`Text or link to the signed agreement. Its hash is stored on chain: ${t.termsHash.slice(0, 18)}…`}
            />
          </Section>
          <Section title="Economics" note="what each side puts up">
            <Field
              label="Token loan"
              unit={base}
              value={draft.loan}
              onChange={set("loan")}
              error={errors.loan}
            />
            <Field
              label="Call options"
              unit={base}
              value={draft.options}
              onChange={set("options")}
              error={errors.options}
            />
            <Field
              label="Strike premium over mid"
              unit="%"
              value={draft.strikePremiumPct}
              onChange={set("strikePremiumPct")}
              error={errors.strikePremiumPct}
              hint={mid ? `strike ${price(t.strike)}` : undefined}
            />
            <Field
              label="Retainer"
              unit={quote}
              value={draft.retainer}
              onChange={set("retainer")}
              error={errors.retainer}
              hint="streams per compliant block"
            />
            <Field
              label="Maker collateral"
              unit={quote}
              value={draft.makerCollateral}
              onChange={set("makerCollateral")}
              error={errors.makerCollateral}
              hint="funds the bid side"
            />
            <Field
              label="Performance bond"
              unit={quote}
              value={draft.bond}
              onChange={set("bond")}
              error={errors.bond}
              hint="pays bounties and slashing"
            />
            <Field
              label="Term"
              unit="hours"
              value={draft.termHours}
              onChange={set("termHours")}
              error={errors.termHours}
            />
            <Field
              label="Early termination notice"
              unit="min"
              value={draft.noticeMinutes}
              onChange={set("noticeMinutes")}
            />
          </Section>
          <Section title="Obligations" note="measured on the Kuru book every block">
            <Field
              label="Max spread"
              unit="bps"
              value={draft.maxSpreadBps}
              onChange={set("maxSpreadBps")}
              error={errors.maxSpreadBps}
            />
            <Field
              label="Max spread when volatile"
              unit="bps"
              value={draft.volatileSpreadBps}
              onChange={set("volatileSpreadBps")}
              error={errors.volatileSpreadBps}
            />
            <Field
              label="Min bid depth"
              unit={quote}
              value={draft.minBidDepth}
              onChange={set("minBidDepth")}
              error={errors.minBidDepth}
            />
            <Field
              label="Min ask depth"
              unit={quote}
              value={draft.minAskDepth}
              onChange={set("minAskDepth")}
              error={errors.minAskDepth}
            />
            <Field
              label="Depth counted within"
              unit="± %"
              value={draft.depthBandPct}
              onChange={set("depthBandPct")}
              error={errors.depthBandPct}
            />
            <Field
              label="Uptime per epoch"
              unit="%"
              value={draft.uptimePct}
              onChange={set("uptimePct")}
              error={errors.uptimePct}
            />
            <Field
              label="Epoch length"
              unit="min"
              value={draft.epochMinutes}
              onChange={set("epochMinutes")}
              error={errors.epochMinutes}
            />
            <Field
              label="Clawback after"
              unit="failed epochs"
              value={draft.sustainedEpochs}
              onChange={set("sustainedEpochs")}
              error={errors.sustainedEpochs}
            />
          </Section>
          <Section title="Enforcement" note="what stops the market maker from gaming it">
            <Field
              label="Quote price band"
              unit="± %"
              value={draft.priceBandPct}
              onChange={set("priceBandPct")}
              error={errors.priceBandPct}
              hint="no quote may sit further from the reference"
            />
            <Field
              label="Net sell limit"
              unit={base}
              value={draft.maxNetSell}
              onChange={set("maxNetSell")}
              error={errors.maxNetSell}
              hint={`per ${draft.sellWindowHours || "?"} hour window`}
            />
            <Field
              label="Sell window"
              unit="hours"
              value={draft.sellWindowHours}
              onChange={set("sellWindowHours")}
              error={errors.sellWindowHours}
            />
            <Field
              label="Minimum quote life"
              unit="blocks"
              value={draft.minQuoteLifeBlocks}
              onChange={set("minQuoteLifeBlocks")}
              hint="stops spoofing"
            />
            <Field
              label="Breach grace"
              unit="blocks"
              value={draft.graceBlocks}
              onChange={set("graceBlocks")}
            />
            <Field
              label="Reference speed limit"
              unit="bps / block"
              value={draft.maxRefStepBps}
              onChange={set("maxRefStepBps")}
            />
            <Field label="Shortfall penalty" unit="%" value={draft.penaltyPct} onChange={set("penaltyPct")} />
            <Field
              label="Bond slash on clawback"
              unit="%"
              value={draft.slashPct}
              onChange={set("slashPct")}
              error={errors.slashPct}
            />
            <Field
              label="Watchtower bounty"
              unit={quote}
              value={draft.watchBounty}
              onChange={set("watchBounty")}
            />
            <Field
              label="Clawback bounty"
              unit={quote}
              value={draft.clawbackBounty}
              onChange={set("clawbackBounty")}
            />
          </Section>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview" meta="against the live book" />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
          {market && book && mid ? (
            <DepthPreview
              market={market}
              bids={book.bids}
              asks={book.asks}
              mid={mid}
              bandBps={t.ob.depthBandBps}
              minBid={t.ob.minBidDepth}
              minAsk={t.ob.minAskDepth}
            />
          ) : (
            <Loading rows={5} />
          )}

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-sm border border-line p-3">
              <h3 className="label mb-2">The issuer escrows</h3>
              <p className="num text-sm text-ink">{fmtB(t.loan)}</p>
              <p className="num text-ink-2">+ {fmtQ(t.retainer)} retainer</p>
              <p className="mt-2 text-ink-3">
                Options on {fmtB(t.options)} at {price(t.strike)}, vesting per compliant block.
              </p>
            </div>
            <div className="rounded-sm border border-line p-3">
              <h3 className="label mb-2">The market maker posts</h3>
              <p className="num text-sm text-ink">{fmtQ(t.makerCollateral)}</p>
              <p className="num text-ink-2">+ {fmtQ(t.bond)} bond</p>
              <p className="mt-2 text-ink-3">
                Gets it all back, less any shortfall, penalty or slashing, at settlement.
              </p>
            </div>
          </div>

          <div className="text-xs">
            <h3 className="label mb-2">In plain terms</h3>
            <ul className="flex flex-col gap-1.5 text-ink-2">
              <li>
                For {blocksToDuration(t.termBlocks)}, keep a two-sided book on Kuru with a spread of at most{" "}
                {t.ob.maxSpreadBps} bps ({t.ob.volatileSpreadBps} bps when the market moves fast).
              </li>
              <li>
                Rest at least {fmtQ(t.ob.minBidDepth)} of bids and {fmtQ(t.ob.minAskDepth)} of asks within ±
                {t.ob.depthBandBps / 100}% of the reference.
              </li>
              <li>
                Meet both at once for {t.ob.uptimeTargetBps / 100}% of every{" "}
                {blocksToDuration(t.ob.epochBlocks)} epoch. {t.ob.sustainedBreachEpochs} failed epochs in a
                row lets anyone claw the loan back.
              </li>
              <li>
                Never sell more than {fmtB(t.risk.maxNetSell)} net per{" "}
                {blocksToDuration(t.risk.sellWindowBlocks)}, and only through post-only quotes within ±
                {t.risk.priceBandBps / 100}% of the reference.
              </li>
              <li>No volume targets. Volume is what wash trading fakes.</li>
            </ul>
          </div>

          {built.warnings.length ? (
            <div className="flex flex-col gap-1.5 text-xs">
              <h3 className="label">Check before proposing</h3>
              {built.warnings.map((w) => (
                <p key={w} className="flex gap-2 text-warn">
                  <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> {w}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
            {address ? (
              <div className="flex flex-col gap-1.5 text-xs text-ink-3">
                {needBase ? (
                  <span>1. Approve {base} for the loan</span>
                ) : (
                  <span className="flex items-center gap-1 text-good">
                    <CircleCheck size={12} /> {base} approved
                  </span>
                )}
                {t.retainer > 0n ? (
                  needQuote ? (
                    <span>2. Approve {quote} for the retainer</span>
                  ) : (
                    <span className="flex items-center gap-1 text-good">
                      <CircleCheck size={12} /> {quote} approved
                    </span>
                  )
                ) : null}
                <span>
                  {t.retainer > 0n ? "3" : "2"}. Propose. The market maker then accepts from the covenant
                  page.
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <Button variant="primary" disabled={!address || step !== null} onClick={submit}>
                {step ? <LoaderCircle size={13} className="animate-spin" /> : null}
                {step ?? (address ? "Propose covenant" : "Connect a wallet to propose")}
              </Button>
              {failure ? <span className="text-xs text-critical">{failure}</span> : null}
              {hasErrors && attempted ? (
                <span className="text-xs text-critical">Fix the highlighted fields first</span>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
