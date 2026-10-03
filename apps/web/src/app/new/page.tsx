import type { Metadata } from "next";
import { Composer } from "@/components/composer/composer";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "New covenant" };

export default function NewCovenantPage() {
  return (
    <>
      <PageHeader
        title="New covenant"
        description="Write a market-making agreement the Kuru order book enforces. You escrow the loan; the market maker accepts and quotes through the escrow."
      />
      <Composer />
    </>
  );
}
