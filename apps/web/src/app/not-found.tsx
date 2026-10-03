import Link from "next/link";
import { Empty } from "@/components/ui/states";

export default function NotFound() {
  return (
    <Empty title="This page does not exist">
      <Link href="/" className="text-accent hover:underline">
        Back to covenants
      </Link>
    </Empty>
  );
}
