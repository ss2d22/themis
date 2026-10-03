"use client";

import { type ReactNode, useEffect, useState } from "react";
import { CommandPalette } from "./command-palette";
import { StatusBar } from "./status-bar";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar onSearch={() => setSearchOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <StatusBar />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
