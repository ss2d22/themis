import { expect, test } from "@playwright/test";
import { accounts, connectWallet } from "./wallet";

test("an issuer proposes a covenant and the market maker accepts it", async ({ browser }) => {
  const issuer = await browser.newPage();
  await connectWallet(issuer, accounts.issuer);
  await issuer.goto("/new");
  await issuer.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(issuer.getByRole("button", { name: /0x7099/ })).toBeVisible();

  await issuer.getByLabel("Market maker address").fill(accounts.maker);
  await issuer.getByLabel("Master agreement").fill("e2e master agreement");
  await expect(issuer.getByText("Rest at least")).toBeVisible();
  await issuer.getByRole("button", { name: "Propose covenant" }).click();

  await issuer.waitForURL(/\/c\/\d+$/, { timeout: 120_000 });
  const url = issuer.url();
  await expect(issuer.getByText("Proposed")).toBeVisible();
  await expect(issuer.getByText("Waiting for the market maker to accept")).toBeVisible();

  const maker = await browser.newPage();
  await connectWallet(maker, accounts.maker);
  await maker.goto(url);
  await maker.getByRole("button", { name: "Connect", exact: true }).click();
  await maker.getByRole("button", { name: "Accept covenant" }).click();
  await maker.getByRole("dialog").getByRole("button", { name: "Accept", exact: true }).click();

  await expect(maker.getByRole("dialog")).toBeHidden({ timeout: 120_000 });
  await expect(maker.getByText("Active", { exact: true })).toBeVisible();
});
