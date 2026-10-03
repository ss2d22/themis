"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "./cn";

/** Single-choice pill row. Radix supplies the radio semantics and arrow-key navigation. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={String(value)}
      onValueChange={(next) => {
        const match = options.find(([v]) => String(v) === next);
        if (match) onChange(match[0]);
      }}
      className="flex items-center gap-1"
    >
      {options.map(([v, text]) => (
        <ToggleGroup.Item
          key={String(v)}
          value={String(v)}
          className={cn(
            "h-6 rounded-sm px-2 text-xs font-medium text-ink-3 hover:bg-hover hover:text-ink-2",
            "data-[state=on]:bg-active data-[state=on]:text-ink",
          )}
        >
          {text}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
