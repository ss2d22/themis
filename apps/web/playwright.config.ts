import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests drive the real app against a local fork. Start one first with `scripts/rehearse.sh`; the tests
 * use anvil's unlocked development accounts as wallets.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
});
