import type { Metadata } from "next";
import { Terminal } from "@/components/terminal/terminal";

export async function generateMetadata({ params }: PageProps<"/c/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Covenant #${id}` };
}

export default async function CovenantPage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  return <Terminal id={id} />;
}
