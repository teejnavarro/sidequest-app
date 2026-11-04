import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Ideas | Sidequest" };

export default function IdeasPage() {
  return (
    <ComingSoon
      title="Ideas"
      text='Every "we should totally go here" in one place.'
    />
  );
}
