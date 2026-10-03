"use client";

import { Menu, Moon, Plus, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Kbd } from "@/components/ui/kbd";
import { Logo } from "./logo";
import { useTheme } from "./preferences";
import { WalletButton } from "./wallet";

const nav = [
  { href: "/", label: "Covenants" },
  { href: "/makers", label: "Makers" },
  { href: "/watchtowers", label: "Watchtowers" },
  { href: "/outcomes", label: "Outcomes" },
  { href: "/stats", label: "Stats" },
  { href: "/docs", label: "How it works" },
];

export function TopBar({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const [theme, setTheme] = useTheme();
  const active = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/c/") : pathname.startsWith(href);

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-panel px-3">
      <Link href="/" className="mr-3 flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
        <Logo />
        Covenant
      </Link>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button size="sm" variant="ghost" className="md:hidden" aria-label="Open navigation">
            <Menu size={14} />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 min-w-48 rounded-sm bg-raised p-1 shadow-pop"
          >
            {nav.map((item) => (
              <DropdownMenu.Item key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-8 items-center rounded-xs px-2 text-sm text-ink-2 outline-none data-[highlighted]:bg-hover",
                    active(item.href) && "text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <nav className="hidden h-full items-stretch md:flex" aria-label="Primary">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex items-center px-2.5 text-xs font-medium text-ink-3 transition-colors hover:text-ink",
              active(item.href) &&
                "text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-px after:bg-accent",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" variant="ghost" className="lg:hidden" aria-label="Search" onClick={onSearch}>
          <Search size={13} />
        </Button>
        <button
          type="button"
          onClick={onSearch}
          className="hidden h-6 w-60 items-center lg:flex gap-2 rounded-sm border border-line bg-bg px-2 text-xs whitespace-nowrap text-ink-3 hover:border-line-strong"
        >
          <Search size={12} />
          Search covenants and makers
          <span className="ml-auto flex gap-0.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <Link href="/new">
          <Button size="sm" variant="primary">
            <Plus size={13} /> <span className="hidden sm:inline">New covenant</span>
          </Button>
        </Link>
        <Button
          size="sm"
          variant="ghost"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
        </Button>
        <WalletButton />
      </div>
    </header>
  );
}
