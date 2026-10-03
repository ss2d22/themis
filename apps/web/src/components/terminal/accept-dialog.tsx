"use client";

import { covenantAbi } from "@covenant/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { type Address, erc20Abi, isAddress, maxUint256 } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import type { MarketInfo } from "@/lib/chain";
import { publicClient, withGasMargin } from "@/lib/chain";
import { env } from "@/lib/env";
import { describeError } from "@/lib/errors";
import { units } from "@/lib/format";
import type { Engagement } from "@/lib/types";

/** The market maker posts collateral and bond, names a quoting key and puts the loan on the book. */
export function AcceptDialog({ e, market }: { e: Engagement; market: MarketInfo }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const required = BigInt(e.terms.makerCollateral) + BigInt(e.terms.bond);
  const key = (operator || address || "") as string;

  const allowance = useQuery({
    queryKey: ["accept-allowance", address, e.id],
    enabled: Boolean(open && address && env.covenant),
    refetchInterval: 3_000,
    queryFn: () =>
      publicClient.readContract({
        address: market.quote,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address as Address, env.covenant as Address],
      }),
  });
  const approved = allowance.data !== undefined && allowance.data >= required;

  async function run() {
    if (!address || !env.covenant || !isAddress(key)) return;
    setFailure(null);
    try {
      if (!approved) {
        setStep(`Approving ${market.quoteSymbol}`);
        const { request } = await publicClient.simulateContract({
          address: market.quote,
          abi: erc20Abi,
          functionName: "approve",
          args: [env.covenant, maxUint256],
          account: address,
        });
        await publicClient.waitForTransactionReceipt({
          hash: await writeContractAsync(await withGasMargin(request)),
        });
      }
      setStep("Accepting");
      const { request } = await publicClient.simulateContract({
        address: env.covenant,
        abi: covenantAbi,
        functionName: "accept",
        args: [BigInt(e.id), key],
        account: address,
      });
      await publicClient.waitForTransactionReceipt({
        hash: await writeContractAsync(await withGasMargin(request)),
      });
      await queryClient.invalidateQueries();
      setOpen(false);
    } catch (error) {
      setFailure(describeError(error));
    } finally {
      setStep(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="primary">
          Accept covenant
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed top-[20vh] left-1/2 z-50 flex w-[440px] -translate-x-1/2 flex-col gap-3 rounded-md bg-raised p-4 shadow-pop">
          <Dialog.Title className="text-sm font-semibold text-ink">Accept covenant #{e.id}</Dialog.Title>
          <Dialog.Description className="text-xs text-ink-3">
            You post {units(e.terms.makerCollateral, market.quoteDecimals, 0)} {market.quoteSymbol} of
            collateral and a {units(e.terms.bond, market.quoteDecimals, 0)} {market.quoteSymbol} bond. The
            issuer’s {units(e.terms.loan, market.baseDecimals, 2)} {market.baseSymbol} moves onto Kuru in an
            account only the escrow controls, and the term starts at once.
          </Dialog.Description>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-3">Quoting key</span>
            <input
              value={operator}
              placeholder={address ?? "0x…"}
              onChange={(event) => setOperator(event.target.value.trim())}
              className="num h-7 rounded-sm border border-line-strong bg-bg px-2 text-sm text-ink outline-none focus:border-accent"
            />
            <span className="text-2xs text-ink-4">
              The hot key your bot quotes with. It can only send post-only quotes through the escrow.
            </span>
          </label>
          <div className="flex flex-col gap-1 text-xs text-ink-3">
            {approved ? (
              <span className="flex items-center gap-1 text-good">
                <CircleCheck size={12} /> {market.quoteSymbol} approved
              </span>
            ) : (
              <span>1. Approve {market.quoteSymbol}</span>
            )}
            <span>{approved ? "1" : "2"}. Accept and start the term</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            {failure ? <span className="mr-auto text-xs text-critical">{failure}</span> : null}
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button variant="primary" disabled={!address || !isAddress(key) || step !== null} onClick={run}>
              {step ? <LoaderCircle size={13} className="animate-spin" /> : null}
              {step ?? "Accept"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
