"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { explorer } from "@/lib/env";
import { shortAddress, shortHash } from "@/lib/format";
import { cn } from "./cn";

export function Address({
  address,
  label,
  className,
}: {
  address: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={cn("group inline-flex items-center gap-1", className)}>
      <a
        href={explorer.address(address)}
        target="_blank"
        rel="noreferrer"
        className="num text-ink-2 hover:text-accent hover:underline"
        title={address}
      >
        {label ?? shortAddress(address)}
      </a>
      <button
        type="button"
        aria-label="Copy address"
        onClick={() => {
          void navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="text-ink-4 opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink-2"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </span>
  );
}

export function TxLink({ hash, className }: { hash: string; className?: string }) {
  return (
    <a
      href={explorer.tx(hash)}
      target="_blank"
      rel="noreferrer"
      className={cn("num text-ink-3 hover:text-accent hover:underline", className)}
      title={hash}
    >
      {shortHash(hash)}
    </a>
  );
}
