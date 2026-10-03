"use client";

import { Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { chain } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    const injected = connectors[0];
    return (
      <Button
        size="sm"
        disabled={!injected || isPending}
        onClick={() => injected && connect({ connector: injected })}
      >
        <Wallet size={13} /> {isPending ? "Connecting…" : "Connect"}
      </Button>
    );
  }
  if (chainId !== chain.id) {
    return (
      <Button size="sm" variant="danger" onClick={() => switchChain({ chainId: chain.id })}>
        Switch to Monad testnet
      </Button>
    );
  }
  return (
    <Button size="sm" variant="ghost" onClick={() => disconnect()} title="Disconnect">
      <span className="size-1.5 rounded-full bg-good" aria-hidden />
      <span className="num">{address ? shortAddress(address) : ""}</span>
    </Button>
  );
}
