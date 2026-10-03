"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

/** A number that briefly flashes when it changes, the way trading screens show ticks. */
export function Num({ value, display, className }: { value: number; display?: string; className?: string }) {
  const previous = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value === previous.current) return;
    setFlash(value > previous.current ? "up" : "down");
    previous.current = value;
    const timer = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <span
      className={cn(
        "num rounded-xs",
        flash === "up" && "animate-flash-up",
        flash === "down" && "animate-flash-down",
        className,
      )}
    >
      {display ?? value.toLocaleString("en-US")}
    </span>
  );
}
