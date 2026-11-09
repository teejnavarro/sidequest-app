import type { ScheduleErrors, ScheduleRaw } from "@/lib/schedule-input";

// What the add and move forms remember between tries. Lives outside the "use server" file
// because such files may only export functions.
export type ScheduleFormValues = ScheduleRaw;

export type ScheduleFormState = {
  errors: ScheduleErrors & { form?: string };
  values: ScheduleFormValues;
};

export const emptyScheduleValues: ScheduleFormValues = {
  kind: "idea",
  ideaId: "",
  name: "",
  notes: "",
  day: "",
  slot: "",
  time: "",
};
