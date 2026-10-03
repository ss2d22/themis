import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClawbackDiagram, LedgerDiagram, SystemDiagram } from "@/components/docs/diagrams";

export const metadata: Metadata = { title: "How it works" };

const sections = [
  ["problem", "The problem"],
  ["covenant", "What a covenant is"],
  ["measure", "What gets measured"],
  ["cannot", "What the market maker cannot do"],
  ["enforce", "Enforcement and settlement"],
  ["outcomes", "Outcome markets"],
  ["why", "Why Kuru on Monad"],
  ["roles", "Who uses it"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 border-b border-line py-8 first:pt-2 last:border-0">
      <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-6 text-ink-2">{children}</div>
    </section>
  );
}

function Figure({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <figure className="my-2 flex flex-col gap-2 rounded-sm border border-line bg-panel p-4">
      {children}
      <figcaption className="text-xs text-ink-3">{caption}</figcaption>
    </figure>
  );
}

const rules: [string, string][] = [
  [
    "Market-sell the loan",
    "Only post-only orders pass the gate. A crossing order is skipped by Kuru, never filled.",
  ],
  [
    "Move or withdraw the loan",
    "The escrow alone owns the Kuru account. The market maker holds no Kuru permission at all.",
  ],
  [
    "Sell the loan cheaply to its own wallet",
    "Quotes must sit inside a band around a rate-limited reference, and any shortfall at settlement is charged at the higher of strike and reference plus a penalty.",
  ],
  [
    "Sell faster than agreed",
    "Net base sold, plus every resting ask, is capped per window. Hook replenishment respects the same cap.",
  ],
  [
    "Show depth that vanishes",
    "Reduce-after-block orders are rejected, quotes have a minimum life, and depth is read from Kuru’s reserved balances.",
  ],
  [
    "Get paid for uptime it did not provide",
    "An interval is credited only if the book was compliant at both ends, and credit per interval is capped.",
  ],
  ["Hit targets with wash trades", "There are no volume targets. Obligations are spread, depth and uptime."],
  ["Walk away during a gas spike", "The only pause is Kuru halting the market, read from the book itself."],
];

export default function DocsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto grid max-w-[1080px] grid-cols-[200px_minmax(0,1fr)] gap-12 px-6 py-8">
        <nav className="sticky top-8 flex h-fit flex-col gap-1 text-sm" aria-label="On this page">
          <span className="label mb-2">On this page</span>
          {sections.map(([id, title]) => (
            <a key={id} href={`#${id}`} className="py-0.5 text-ink-3 hover:text-ink">
              {title}
            </a>
          ))}
        </nav>

        <article className="max-w-[720px]">
          <header className="mb-4 border-b border-line pb-6">
            <h1 className="text-xl font-semibold text-ink">How Covenant works</h1>
            <p className="mt-2 text-sm leading-6 text-ink-2">
              Covenant turns a token launch’s market-making agreement into a contract the order book enforces.
              The loan, the options and every obligation live on Kuru, where anyone can check them and anyone
              can enforce them.
            </p>
          </header>

          <Section id="problem" title="The problem">
            <p>
              Almost every token launch hires a market maker on the same structure. The project lends the
              market maker tokens to quote with and grants it call options to buy them later at a set price.
              In return the market maker promises a tight spread, enough depth and steady uptime.
            </p>
            <p>
              Those promises are written in a private agreement and measured, if at all, from data the market
              maker chooses to share. Holders cannot see the terms. The project cannot easily prove a breach.
              And the loan sits in the market maker’s own wallet, so nothing stops it from being sold into the
              launch instead of supporting it.
            </p>
          </Section>

          <Section id="covenant" title="What a covenant is">
            <p>
              A covenant is the same deal, held by an escrow contract that owns a Kuru account. The issuer
              escrows the loan and any retainer. The market maker accepts by posting quote collateral and a
              performance bond, and from then on it can only quote through the escrow.
            </p>
            <Figure caption="The escrow is the only party that can trade the covenant’s Kuru account. Watchtowers enforce it and the outcome market reads its ledger.">
              <SystemDiagram />
            </Figure>
            <p>
              Every quote passes a gate before it reaches Kuru, every fill that empties a slot calls back into
              the escrow, and every one of those moments is recorded. Options and retainer vest only for the
              blocks in which every target was met at once.
            </p>
          </Section>

          <Section id="measure" title="What gets measured">
            <p>Three obligations, all read from the book itself:</p>
            <ul className="ml-4 list-disc">
              <li>
                <span className="text-ink">Spread</span>: the escrow’s best ask minus its best bid, relative
                to the reference price. A wider allowance applies when the market moves faster than the
                reference may.
              </li>
              <li>
                <span className="text-ink">Depth</span>: resting bids and asks inside a band around the
                reference, taken from Kuru’s reserved balances so partially filled orders count only for what
                is left.
              </li>
              <li>
                <span className="text-ink">Uptime</span>: the share of each epoch in which spread and both
                depths were met together. Failing an epoch’s target counts toward clawback.
              </li>
            </ul>
            <Figure caption="The ledger is pessimistic. The market maker keeps intervals short simply by quoting; a silent book earns at most the capped credit.">
              <LedgerDiagram />
            </Figure>
          </Section>

          <Section id="cannot" title="What the market maker cannot do">
            <div className="overflow-hidden rounded-sm border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-panel text-ink-3">
                  <tr>
                    <th className="w-1/3 px-3 py-2 font-medium">Attempt</th>
                    <th className="px-3 py-2 font-medium">Why it fails</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(([attempt, why]) => (
                    <tr key={attempt} className="border-t border-line align-top">
                      <td className="px-3 py-2 text-ink">{attempt}</td>
                      <td className="px-3 py-2 text-ink-2">{why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              The issuer is bound too: options and retainer are escrowed up front and vest mechanically, and
              the agreement can only be ended early after the agreed notice.
            </p>
          </Section>

          <Section id="enforce" title="Enforcement and settlement">
            <p>
              Enforcement is permissionless. Anyone can record the book, close a finished epoch or claw back a
              covenant whose market maker failed too many epochs in a row, and each of those actions pays a
              bounty from the market maker’s bond.
            </p>
            <Figure caption="A clawback ends the covenant early. The issuer’s inventory goes back on the same book as Kuru passive liquidity, so the market never loses its depth.">
              <ClawbackDiagram />
            </Figure>
            <p>
              At maturity or clawback the escrow cancels every quote and splits what is left. The issuer is
              owed the loan back in tokens. Anything the market maker sold and did not buy back is paid for at
              the strike, using vested options, and above that at the higher of strike and reference plus a
              penalty. If the market maker’s quote runs short, the bond makes up the difference.
            </p>
          </Section>

          <Section id="outcomes" title="Outcome markets">
            <p>
              For any active covenant, anyone can open a market on whether its market maker meets the uptime
              target over a range of epochs. One unit of quote mints one KEPT and one BROKEN. When the period
              ends, the escrow’s own ledger decides which side redeems, so there is no oracle and nothing to
              dispute.
            </p>
            <p>
              Holders hedge a market maker failing them. Issuers buy BROKEN as cover. Market makers signal
              confidence by holding KEPT. Listed on Kuru, the KEPT price becomes a live, market-set rating of
              the promise.
            </p>
          </Section>

          <Section id="why" title="Why Kuru on Monad">
            <p>
              The design needs an order book that is contract state, so an escrow can own orders, read
              reserves and be called back on fills. Kuru provides exactly that: contract-owned accounts,
              packed slot quoting, reserved balances per account and post-fill hooks.
            </p>
            <p>
              It also needs blocks fast and cheap enough that routing every quote through a contract, and
              measuring uptime block by block, costs a market maker nothing it would notice. At 400 ms blocks
              a covenant can require quotes to rest for just over a second and still measure a day as more
              than two hundred thousand blocks.
            </p>
          </Section>

          <Section id="roles" title="Who uses it">
            <ul className="ml-4 list-disc">
              <li>
                <span className="text-ink">Issuers</span> launching on Kuru write the covenant from{" "}
                <Link href="/new" className="text-accent hover:underline">
                  New covenant
                </Link>{" "}
                and get liquidity they can prove, plus an automatic exit if it fails.
              </li>
              <li>
                <span className="text-ink">Market makers</span> earn a public, verifiable record on{" "}
                <Link href="/makers" className="text-accent hover:underline">
                  Maker ratings
                </Link>{" "}
                and payment the issuer cannot withhold.
              </li>
              <li>
                <span className="text-ink">Watchtowers</span> earn bounties for keeping every covenant honest.
                See{" "}
                <Link href="/watchtowers" className="text-accent hover:underline">
                  Watchtowers
                </Link>
                .
              </li>
              <li>
                <span className="text-ink">Holders</span> check the live report card for any covenant before
                they trade.
              </li>
            </ul>
          </Section>
        </article>
      </div>
    </div>
  );
}
