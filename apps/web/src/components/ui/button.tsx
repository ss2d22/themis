import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "default" | "primary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  default: "bg-raised text-ink border border-line-strong hover:bg-hover",
  primary: "bg-accent text-white border border-transparent hover:brightness-110",
  ghost: "text-ink-2 border border-transparent hover:bg-hover hover:text-ink",
  danger: "bg-critical text-white border border-transparent hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-6 px-2 text-xs gap-1",
  md: "h-7 px-2.5 text-sm gap-1.5",
};

export function Button({
  variant = "default",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex select-none items-center justify-center rounded-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
