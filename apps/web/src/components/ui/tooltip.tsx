"use client";

import { Tooltip as T } from "radix-ui";
import type { ReactNode } from "react";

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <T.Provider delayDuration={250} skipDelayDuration={100}>
    {children}
  </T.Provider>
);

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-w-72 rounded-sm bg-raised px-2 py-1.5 text-xs text-ink-2 shadow-pop"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
