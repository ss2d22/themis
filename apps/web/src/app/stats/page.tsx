"use client";

import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback } from "react";
import { ActivityChart } from "@/components/charts/activity-chart";
import { StatsRibbon } from "@/components/covenants/stats-ribbon";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { useTimeseries } from "@/lib/api";
import { BLOCK_SECONDS } from "@/lib/env";

const buckets = [
  [300, "5 min"],
  [900, "15 min"],
  [3_600, "1 hour"],
  [86_400, "1 day"],
] as const;

export default function StatsPage() {
  const [bucket, setBucket] = useQueryState("bucket", parseAsInteger.withDefault(900));
  const series = useTimeseries(bucket);
  const minutes = useCallback((blocks: number) => ((blocks * BLOCK_SECONDS) / 60).toFixed(1), []);
  const count = useCallback((v: number) => v.toLocaleString("en-US"), []);
  const d = series.data;

  return (
    <>
      <PageHeader
        title="Stats"
        description="Activity across every covenant, read from on-chain events by the indexer."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-3">Per</span>
            <Segmented label="Bucket size" value={bucket} options={buckets} onChange={setBucket} />
          </div>
        }
      />
      <StatsRibbon />
      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-px bg-line transition-opacity",
          series.isFetching && !d && "opacity-60",
        )}
      >
        <Panel>
          <ActivityChart
            title="Fills against covenant quotes"
            unit="fills"
            points={d?.fills ?? []}
            bucket={bucket}
            format={count}
          />
        </Panel>
        <Panel>
          <ActivityChart
            title="Liquidity time credited"
            unit="min"
            points={d?.credited ?? []}
            bucket={bucket}
            format={minutes}
          />
        </Panel>
        <Panel>
          <ActivityChart
            title="Quote updates through the gate"
            unit="updates"
            points={d?.quotes ?? []}
            bucket={bucket}
            format={count}
          />
        </Panel>
        <Panel>
          <ActivityChart
            title="Breaches recorded"
            unit="breaches"
            points={d?.breaches ?? []}
            bucket={bucket}
            format={count}
          />
        </Panel>
      </div>
    </>
  );
}
