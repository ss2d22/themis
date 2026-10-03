import { cn } from "@/components/ui/cn";

/**
 * Horizontal bar for a value against a target. The target is a hairline tick; the bar takes the status colour
 * only when it falls short, and the numeric label always sits beside it.
 */
export function TargetMeter({
  value,
  target,
  max = 1,
  label,
  width = 56,
}: {
  value: number;
  target: number;
  max?: number;
  label: string;
  width?: number;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n / max));
  const short = value < target;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative h-1.5 rounded-full bg-hover" style={{ width }} aria-hidden>
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", short ? "bg-critical" : "bg-ink-3")}
          style={{ width: `${clamp(value) * 100}%` }}
        />
        <span
          className="absolute -top-0.5 -bottom-0.5 w-px bg-ink"
          style={{ left: `${clamp(target) * 100}%` }}
        />
      </span>
      <span className={cn("num", short ? "text-critical" : "text-ink-2")}>{label}</span>
    </span>
  );
}
