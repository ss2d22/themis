"use client";

import { Eye } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { useStats } from "@/lib/api";
import { useHead } from "@/lib/chain";
import { usePalette } from "./preferences";

export function StatusBar() {
  const head = useHead();
  const stats = useStats();
  const [palette, setPalette] = usePalette();
  const healthy = head.isSuccess && !head.isError;

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 text-2xs text-ink-3">
      <span className="flex items-center gap-1.5">
        <span
          className={cn("size-1.5 rounded-full", healthy ? "animate-pulse-dot bg-good" : "bg-critical")}
          aria-hidden
        />
        <span className="hidden sm:inline">Monad testnet</span>
      </span>
      <span className="num">block {head.data ? head.data.block.toLocaleString("en-US") : "—"}</span>
      <span className="num hidden sm:inline">rpc {head.data ? `${head.data.latencyMs}ms` : "—"}</span>
      <span className={cn("num", stats.isError && "text-critical")}>
        indexer {stats.isError ? "offline" : stats.data ? "live" : "…"}
      </span>
      <div className="ml-auto hidden items-center gap-4 md:flex">
        <Tooltip content="Swap bid and ask to a blue/orange pair that stays distinct for colour-blind readers.">
          <button
            type="button"
            onClick={() => setPalette(palette === "cvd" ? "standard" : "cvd")}
            className={cn("flex items-center gap-1 hover:text-ink-2", palette === "cvd" && "text-ink-2")}
          >
            <Eye size={11} /> {palette === "cvd" ? "Colour-blind palette on" : "Colour-blind palette"}
          </button>
        </Tooltip>
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="hover:text-ink-2">
          Charts by TradingView
        </a>
      </div>
    </footer>
  );
}
