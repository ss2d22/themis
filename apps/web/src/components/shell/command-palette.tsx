"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { useEngagements } from "@/lib/api";
import { shortAddress } from "@/lib/format";
import { statusLabel } from "@/lib/types";
import { usePalette, useTheme } from "./preferences";

const pages = [
  ["/", "Covenants"],
  ["/makers", "Maker ratings"],
  ["/watchtowers", "Watchtowers"],
  ["/outcomes", "Outcome markets"],
  ["/stats", "Stats"],
  ["/new", "New covenant"],
  ["/docs", "How it works"],
] as const;

function Item({ children, onSelect, value }: { children: ReactNode; onSelect: () => void; value: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm text-ink-2 data-[selected=true]:bg-hover data-[selected=true]:text-ink"
    >
      {children}
    </Command.Item>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const engagements = useEngagements();
  const [theme, setTheme] = useTheme();
  const [palette, setPalette] = usePalette();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[18vh] left-1/2 z-50 w-[560px] -translate-x-1/2 overflow-hidden rounded-md bg-raised shadow-pop"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Command loop>
            <Command.Input
              autoFocus
              placeholder="Jump to a covenant, maker or page…"
              className="h-10 w-full border-b border-line bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-4"
            />
            <Command.List className="max-h-80 overflow-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-ink-3">No matches</Command.Empty>
              <Command.Group
                heading="Covenants"
                className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {(engagements.data ?? []).map((e) => (
                  <Item
                    key={e.id}
                    value={`covenant ${e.id} ${e.maker} ${e.market}`}
                    onSelect={() => go(`/c/${e.id}`)}
                  >
                    <span className="num text-ink">#{e.id}</span>
                    <span className="num text-ink-3">{shortAddress(e.maker)}</span>
                    <span className="ml-auto text-xs text-ink-3">{statusLabel[e.status]}</span>
                  </Item>
                ))}
              </Command.Group>
              <Command.Group
                heading="Go to"
                className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {pages.map(([href, label]) => (
                  <Item key={href} value={`page ${label}`} onSelect={() => go(href)}>
                    {label}
                  </Item>
                ))}
              </Command.Group>
              <Command.Group
                heading="Preferences"
                className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                <Item value="theme toggle" onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  Switch to {theme === "dark" ? "light" : "dark"} theme
                </Item>
                <Item
                  value="palette colour blind"
                  onSelect={() => setPalette(palette === "cvd" ? "standard" : "cvd")}
                >
                  {palette === "cvd" ? "Use standard bid/ask colours" : "Use colour-blind bid/ask colours"}
                </Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
