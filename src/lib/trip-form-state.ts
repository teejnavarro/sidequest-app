import type { TripErrors, TripInput } from "@/lib/trip-input";
import { DEFAULT_CURRENCY, DEFAULT_TIME_ZONE } from "@/lib/trip-options";

// What the trip form remembers between tries. Lives outside the "use server" file
// because such files may only export functions.
// Everything is text here, so the destination box is "" rather than null.
export type TripFormValues = Omit<TripInput, "destination"> & { destination: string };

export type TripFormState = {
  errors: TripErrors & { form?: string };
  values: TripFormValues;
};

export const emptyTripValues: TripFormValues = {
  name: "",
  startDate: "",
  endDate: "",
  timeZone: DEFAULT_TIME_ZONE,
  currency: DEFAULT_CURRENCY,
  destination: "",
};
