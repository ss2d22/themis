import type { ReactNode } from "react";
import { Address } from "@/components/ui/address";
import type { MarketInfo } from "@/lib/chain";
import { blocksToDuration, units } from "@/lib/format";
import { type Engagement, templateLabel } from "@/lib/types";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="num text-right text-ink-2">{children}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-line px-3 py-2 last:border-0">
      <h3 className="label mb-1">{title}</h3>
      <dl className="text-xs">{children}</dl>
    </div>
  );
}

/** Every number the issuer and market maker agreed to, as written into the escrow. */
export function Terms({ e, market }: { e: Engagement; market: MarketInfo }) {
  const t = e.terms;
  const q = (v: string) => `${units(v, market.quoteDecimals, 0)} ${market.quoteSymbol}`;
  const b = (v: string) => `${units(v, market.baseDecimals, 2)} ${market.baseSymbol}`;
  const price = (v: number) => (v / Number(market.pricePrecision)).toLocaleString("en-US");
  const pct = (bps: number) => `${bps / 100}%`;
  const twoSided = (t.template ?? 0) === 0;
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Group title="Economics">
        <Row label="Type">{templateLabel[t.template ?? 0]}</Row>
        <Row label={t.template === 1 ? "Buyback budget" : t.template === 2 ? "Tokens to sell" : "Token loan"}>
          {t.template === 1 ? q(t.loan) : b(t.loan)}
        </Row>
        {twoSided ? (
          <Row label="Call options">
            {b(t.options)} @ {price(t.strike)}
          </Row>
        ) : null}
        <Row label="Retainer">{q(t.retainer)}</Row>
        {twoSided ? <Row label="Maker collateral">{q(t.makerCollateral)}</Row> : null}
        <Row label="Performance bond">{q(t.bond)}</Row>
        <Row label="Term">{blocksToDuration(t.termBlocks)}</Row>
      </Group>
      <Group title="Obligations">
        {twoSided ? (
          <>
            <Row label="Max spread">{t.ob.maxSpreadBps} bps</Row>
            <Row label="Volatile max spread">{t.ob.volatileSpreadBps} bps</Row>
          </>
        ) : null}
        {t.template !== 2 ? <Row label="Min bid depth">{q(t.ob.minBidDepth)}</Row> : null}
        {t.template !== 1 ? <Row label="Min ask depth">{q(t.ob.minAskDepth)}</Row> : null}
        <Row label="Depth band">±{pct(t.ob.depthBandBps)}</Row>
        <Row label="Uptime per epoch">≥ {pct(t.ob.uptimeTargetBps)}</Row>
        <Row label="Epoch">{blocksToDuration(t.ob.epochBlocks)}</Row>
        <Row label="Volume target">none</Row>
      </Group>
      <Group title="Enforcement">
        <Row label="Clawback after">{t.ob.sustainedBreachEpochs} failed epochs</Row>
        <Row label="Quote price band">±{pct(t.risk.priceBandBps)}</Row>
        <Row label={t.template === 1 ? "Net buy limit" : "Net sell limit"}>
          {b(t.risk.maxNetSell)} / {blocksToDuration(t.risk.sellWindowBlocks)}
        </Row>
        <Row label="Min quote life">{t.ob.minQuoteLifeBlocks} blocks</Row>
        <Row label="Max credit per check">{blocksToDuration(t.ob.maxCreditBlocks)}</Row>
        <Row label="Breach grace">{t.ob.graceBlocks} blocks</Row>
        <Row label="Shortfall penalty">{pct(t.risk.penaltyBps)}</Row>
        <Row label="Bond slash on clawback">{pct(t.risk.breachSlashBps)}</Row>
        <Row label="Watchtower bounty">{q(t.risk.watchBounty)}</Row>
        <Row label="Clawback bounty">{q(t.risk.clawbackBounty)}</Row>
      </Group>
      <Group title="Parties">
        <Row label="Issuer">
          <Address address={e.issuer} />
        </Row>
        <Row label="Market maker">
          <Address address={e.maker} />
        </Row>
        {e.operator ? (
          <Row label="Quoting key">
            <Address address={e.operator} />
          </Row>
        ) : null}
        <Row label="Kuru account">{e.account ?? "—"}</Row>
        <Row label="Terms hash">
          <span title={t.termsHash}>{`${t.termsHash.slice(0, 10)}…`}</span>
        </Row>
      </Group>
    </div>
  );
}
