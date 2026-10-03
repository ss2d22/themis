"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { ComplianceHeatmap } from "@/components/charts/compliance-heatmap";
import { DepthChart } from "@/components/charts/depth-chart";
import { PriceChart } from "@/components/charts/price-chart";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Empty, ErrorState, Loading } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReport } from "@/lib/api";
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

  if (report.error) return <ErrorState error={report.error} />;
  if (!report.data || !e || !market) return <Loading rows={12} />;
  const r = report.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TerminalHeader e={e} live={live.data} market={market} head={head} />
      <MetricStrip e={e} live={live.data} market={market} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] grid-rows-[minmax(0,1fr)_260px] gap-px bg-line">
        <Panel>
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
        <Panel className="row-span-2">
          <PanelHeader title="Order book" meta="Kuru, live" />
          <div className="flex min-h-0 flex-[3] flex-col">
            <OrderBook
              market={market}
              quotes={live.data?.quotes ?? []}
              refPrice={BigInt(live.data?.engagement.refPrice ?? e.refPrice ?? 0)}
              bandBps={e.terms.ob.depthBandBps}
            />
          </div>
          <PanelHeader title="Covenant terms" meta="as written on chain" className="border-t" />
          <div className="flex min-h-0 flex-[2] flex-col">
            <Terms e={e} market={market} />
          </div>
        </Panel>
        <Panel>
          <History report={r} market={market} />
        </Panel>
      </div>
    </div>
  );
}
