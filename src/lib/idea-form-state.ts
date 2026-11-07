import type { IdeaErrors, IdeaRaw } from "@/lib/idea-input";

// What the idea form remembers between tries. Lives outside the "use server" file because
// such files may only export functions.
export type IdeaFormValues = IdeaRaw;

export type IdeaFormState = {
  errors: IdeaErrors & { form?: string };
  values: IdeaFormValues;
};

export const emptyIdeaValues: IdeaFormValues = {
  name: "",
  type: "",
  duration: "",
  link: "",
  area: "",
  costPerPerson: "",
  notes: "",
};
