import { expect, type Page, test } from "@playwright/test";
import { accounts, connectWallet } from "./wallet";

const balance = async (page: Page, token: "KEPT" | "BROKEN") => {
  const text = await page.getByRole("group", { name: `${token} balance` }).innerText();
  return Number(text.replace(token, "").replace(/,/g, "").trim());
};

test("a holder mints a KEPT and BROKEN set", async ({ page }) => {
  await connectWallet(page, accounts.issuer);
  await page.goto("/outcomes?m=1");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("group", { name: "KEPT balance" })).not.toContainText("—");
  const before = { kept: await balance(page, "KEPT"), broken: await balance(page, "BROKEN") };

  await page.getByLabel("Amount").fill("25");
  const approve = page.getByRole("button", { name: /Approve USDC/ });
  if (await approve.isVisible()) {
    await approve.click();
    await expect(page.getByText("Confirmed")).toBeVisible();
  }
  await page.getByRole("button", { name: "Mint set" }).click();
  await expect(page.getByText("Confirmed")).toBeVisible();

  await expect.poll(() => balance(page, "KEPT")).toBe(before.kept + 25);
  await expect.poll(() => balance(page, "BROKEN")).toBe(before.broken + 25);
});
