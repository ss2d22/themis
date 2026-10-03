import type { Page } from "@playwright/test";

/** Anvil's unlocked development accounts, funded by the rehearsal. */
export const accounts = {
  issuer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  maker: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
} as const;

/**
 * Installs an EIP-1193 provider that signs as `account` by forwarding every request to the fork, where anvil holds
 * the keys. The app sees an ordinary injected wallet.
 */
export async function connectWallet(
  page: Page,
  account: string,
  rpc = process.env.E2E_RPC_URL ?? "http://127.0.0.1:8545",
) {
  await page.addInitScript(
    ({ account, rpc }) => {
      const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      (window as unknown as { ethereum: unknown }).ethereum = {
        isMetaMask: true,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
          if (method === "wallet_requestPermissions") return [{ parentCapability: "eth_accounts" }];
          if (method === "wallet_switchEthereumChain") return null;
          const response = await fetch(rpc, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params ?? [] }),
          });
          const body = await response.json();
          if (body.error) throw Object.assign(new Error(body.error.message), body.error);
          return body.result;
        },
        on: (event: string, handler: (...args: unknown[]) => void) => {
          handlers[event] = [...(handlers[event] ?? []), handler];
        },
        removeListener: () => {},
      };
    },
    { account, rpc },
  );
}
