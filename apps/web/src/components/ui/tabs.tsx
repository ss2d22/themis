"use client";

import { Tabs as T } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export const Tabs = T.Root;
export const TabsContent = ({ className, ...props }: ComponentProps<typeof T.Content>) => (
  <T.Content
    className={cn("min-h-0 flex-1 outline-none data-[state=inactive]:hidden", className)}
    {...props}
  />
);

export function TabsList({
  children,
  className,
  end,
}: {
  children: ReactNode;
  className?: string;
  end?: ReactNode;
}) {
  return (
    <div className={cn("flex h-8 shrink-0 items-stretch border-b border-line pl-1 pr-2", className)}>
      <T.List className="flex items-stretch">{children}</T.List>
      {end ? <div className="ml-auto flex items-center gap-2">{end}</div> : null}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  count,
}: {
  value: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <T.Trigger
      value={value}
      className="relative flex items-center gap-1.5 px-2.5 text-xs font-medium text-ink-3 transition-colors hover:text-ink-2 data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:bottom-0 data-[state=active]:after:h-px data-[state=active]:after:bg-accent"
    >
      {children}
      {count !== undefined ? <span className="num text-2xs text-ink-4">{count}</span> : null}
    </T.Trigger>
  );
}
