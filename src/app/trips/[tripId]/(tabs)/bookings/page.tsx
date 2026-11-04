import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Bookings | Sidequest" };

export default function BookingsPage() {
  return (
    <ComingSoon
      title="Bookings"
      text='Flights and stays, so no one digs through the group chat at the airport.'
    />
  );
}
