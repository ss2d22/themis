import { Ban, CircleCheck, CircleDashed, CircleDot, CircleX, OctagonAlert, Undo2 } from "lucide-react";
import type { Status } from "@/lib/types";
import { statusLabel } from "@/lib/types";
import { cn } from "./cn";

const tone: Record<Status, { icon: typeof CircleCheck; className: string }> = {
  1: { icon: CircleDashed, className: "text-ink-2" },
  2: { icon: CircleDot, className: "text-accent" },
  3: { icon: OctagonAlert, className: "text-critical" },
  4: { icon: CircleCheck, className: "text-ink-2" },
  5: { icon: Undo2, className: "text-serious" },
  6: { icon: Ban, className: "text-ink-3" },
};

export function StatusBadge({ status }: { status: Status }) {
  const { icon: Icon, className } = tone[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", className)}>
      <Icon size={13} strokeWidth={2} aria-hidden />
      {statusLabel[status]}
    </span>
  );
}

/** Live compliance: icon + word, never colour alone. */
export function ComplianceBadge({ compliant, suspended }: { compliant: boolean; suspended?: boolean }) {
  if (suspended)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-warn">
        <CircleDashed size={13} strokeWidth={2} aria-hidden /> Suspended
      </span>
    );
  return compliant ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-good">
      <CircleCheck size={13} strokeWidth={2} aria-hidden /> In compliance
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-critical">
      <CircleX size={13} strokeWidth={2} aria-hidden /> In breach
    </span>
  );
}
