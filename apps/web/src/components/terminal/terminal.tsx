"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Address } from "viem";
import { ComplianceHeatmap } from "@/components/charts/compliance-heatmap";
import { DepthChart } from "@/components/charts/depth-chart";
import { PriceChart } from "@/components/charts/price-chart";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Empty, ErrorState, Loading } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotFoundError, useReport } from "@/lib/api";
import { useHead } from "@/lib/chain";
import { useLiveCovenant } from "@/lib/covenant";
import { useMarket } from "@/lib/markets";
import { TerminalHeader } from "./header";
import { History } from "./history";
import { MetricStrip } from "./metric-strip";
import { OrderBook } from "./order-book";
import { Terms } from "./terms";

export function Terminal({ id }: { id: string }) {
  const report = useReport(id);
  const live = useLiveCovenant(BigInt(id));
  const head = useHead().data?.block ?? 0n;
  const e = report.data?.engagement;
  const market = useMarket(e?.market as Address | undefined).data;

  const depthTargets = useMemo(() => {
    if (!e || !market) return { minBid: 0, minAsk: 0 };
    const scale = 10 ** market.quoteDecimals;
    return { minBid: Number(e.terms.ob.minBidDepth) / scale, minAsk: Number(e.terms.ob.minAskDepth) / scale };
  }, [e, market]);

  if (report.error instanceof NotFoundError)
    return (
      <Empty title={`There is no covenant #${id}`}>
        It may not have been proposed yet, or the indexer has not reached it.{" "}
        <Link href="/" className="text-accent hover:underline">
          See all covenants
        </Link>
      </Empty>
    );
  if (report.error) return <ErrorState error={report.error} />;
  if (!report.data || !e || !market) return <Loading rows={12} />;
  const r = report.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto lg:overflow-hidden">
      <TerminalHeader e={e} live={live.data} market={market} head={head} />
      <MetricStrip e={e} live={live.data} market={market} />
      <div className="grid shrink-0 grid-cols-1 gap-px bg-line lg:min-h-0 lg:flex-1 lg:shrink lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)_clamp(180px,28vh,300px)]">
        <Panel className="h-[560px] lg:h-auto">
          <Tabs defaultValue="price" className="flex min-h-0 flex-1 flex-col">
            <TabsList
              end={
                <span className="text-2xs text-ink-3">
                  Reference moves at most {e.terms.risk.maxRefStepBps} bps per block
                </span>
              }
            >
              <TabsTrigger value="price">Price</TabsTrigger>
              <TabsTrigger value="depth">Depth</TabsTrigger>
            </TabsList>
            <TabsContent value="price" className="relative">
              {r.observations.length ? (
                <PriceChart
                  market={market}
                  observations={r.observations}
                  fills={r.fills}
                  changes={r.changes}
                  strike={e.terms.strike / Number(market.pricePrecision)}
                  sides={e.terms.template === 1 ? "bids" : e.terms.template === 2 ? "asks" : "both"}
                />
              ) : (
                <Empty title="No observations yet">
                  The chart fills in as soon as the market maker starts quoting.
                </Empty>
              )}
            </TabsContent>
            <TabsContent value="depth" className="relative">
              <DepthChart
                observations={r.observations}
                quoteDecimals={market.quoteDecimals}
                quoteSymbol={market.quoteSymbol}
                minBid={depthTargets.minBid}
                minAsk={depthTargets.minAsk}
              />
            </TabsContent>
          </Tabs>
          {e.startBlock && e.endBlock ? (
            <div className="h-[132px] shrink-0 border-t border-line">
              <ComplianceHeatmap
                startBlock={BigInt(e.startBlock)}
                endBlock={BigInt(e.endBlock)}
                head={BigInt(r.head) > head ? BigInt(r.head) : head}
                epochBlocks={e.terms.ob.epochBlocks}
                targetBps={e.terms.ob.uptimeTargetBps}
                observations={r.observations}
                epochs={r.epochs}
              />
            </div>
          ) : null}
        </Panel>
        <Panel className="h-[880px] lg:row-span-2 lg:h-auto">
          <PanelHeader title="Order book" meta="Kuru, live" />
          <div className="flex min-h-0 flex-[3] flex-col">
            <OrderBook
              market={market}
              quotes={live.data?.quotes ?? []}
              refPrice={BigInt(live.data?.engagement.refPrice || e.refPrice || e.terms.initialPrice)}
              bandBps={e.terms.ob.depthBandBps}
            />
          </div>
          <PanelHeader title="Covenant terms" meta="as written on chain" className="border-t" />
          <div className="flex min-h-0 flex-[2] flex-col">
            <Terms e={e} market={market} />
          </div>
        </Panel>
        <Panel className="h-[440px] lg:h-auto">
          <History report={r} market={market} />
        </Panel>
      </div>
    </div>
  );
}
