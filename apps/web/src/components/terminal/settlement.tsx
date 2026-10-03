import type { ReactNode } from "react";
import type { MarketInfo } from "@/lib/chain";
import { units } from "@/lib/format";
import type { Engagement } from "@/lib/types";

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="label mb-1">{title}</h3>
      {children}
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1 text-xs">
      <span className="text-ink-3">{label}</span>
      <span className={strong ? "num font-medium text-ink" : "num text-ink-2"}>{value}</span>
    </div>
  );
}

/** How the closing inventory was split, line by line, as the escrow computed it. */
export function Settlement({ e, market }: { e: Engagement; market: MarketInfo }) {
  const s = e.settlement;
  if (!s) return null;
  const b = (v: string) => `${units(v, market.baseDecimals, 4)} ${market.baseSymbol}`;
  const q = (v: string) => `${units(v, market.quoteDecimals)} ${market.quoteSymbol}`;
  const clawed = e.status === 5;
  const shortfall = BigInt(s.shortfall);
  const exercised = BigInt(s.exercised);

  return (
    <div className="grid grid-cols-3 gap-8 px-4 py-3">
      <Column title="Base">
        <Line label="Loan owed to issuer" value={b(e.terms.loan)} />
        <Line
          label={clawed ? "Issuer, as passive liquidity" : "Returned to issuer"}
          value={b(s.issuerBase)}
          strong
        />
        <Line label="Kept by market maker" value={b(s.makerBase)} />
        <Line label="Shortfall (sold, not bought back)" value={b(s.shortfall)} />
        <Line label="Covered by vested options" value={b(s.exercised)} />
      </Column>
      <Column title="Quote">
        <Line label="Paid to issuer" value={q(s.issuerQuote)} strong />
        <Line label="Returned to market maker" value={q(s.makerQuote)} />
        <p className="pt-2 text-xs text-ink-3">
          {shortfall === 0n
            ? "The market maker returned the full loan, so nothing was owed in quote."
            : `${exercised > 0n ? `${b(s.exercised)} was settled at the strike using vested options. ` : ""}${
                shortfall > exercised
                  ? `The remaining shortfall was charged at the higher of strike and reference plus the ${e.terms.risk.penaltyBps / 100}% penalty.`
                  : ""
              }`}
        </p>
      </Column>
      <Column title="Bond">
        <Line label="To issuer" value={q(s.bondToIssuer)} strong={BigInt(s.bondToIssuer) > 0n} />
        <Line label="Back to market maker" value={q(s.bondToMaker)} />
        <Line label="Unrecovered deficit" value={q(s.deficit)} />
        {clawed ? (
          <p className="pt-2 text-xs text-ink-3">
            Clawed back: {e.terms.risk.breachSlashBps / 100}% of the remaining bond went to the issuer, and
            the issuer’s inventory was placed on the book as Kuru passive liquidity
            {e.backstopPosition ? ` (position ${e.backstopPosition})` : ""}.
          </p>
        ) : null}
      </Column>
    </div>
  );
}
