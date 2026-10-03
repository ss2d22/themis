import { cn } from "@/components/ui/cn";

export const GRADES = [
  ["AAA", "≥ 99% uptime"],
  ["AA", "≥ 97%"],
  ["A", "≥ 95%"],
  ["BBB", "≥ 90%"],
  ["BB", "≥ 80%"],
  ["B", "≥ 70%"],
  ["CCC", "below 70%"],
  ["D", "any unrecovered default"],
] as const;

/** Letter grade chip. Higher grades stay neutral; CCC and D take the critical ink alongside the letter. */
export function GradeBadge({ grade }: { grade: string }) {
  const low = grade === "CCC" || grade === "D";
  const mid = grade === "BB" || grade === "B";
  return (
    <span
      className={cn(
        "num inline-flex h-5 min-w-9 items-center justify-center rounded-xs border px-1 text-xs font-medium",
        low
          ? "border-critical/50 text-critical"
          : mid
            ? "border-line-strong text-ink-2"
            : "border-line-strong text-ink",
      )}
    >
      {grade}
    </span>
  );
}
