import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Costs | Sidequest" };

export default function CostsPage() {
  return (
    <ComingSoon
      title="Costs"
      text='Who paid, who owes, and no awkward chats about it.'
    />
  );
}
