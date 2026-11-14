// The categories a cost can have. Plain data: safe on the client and the server. The stored
// value is the `value` below, so labels and icons can change later without touching saved
// costs. A cost with no category shows the Receipt icon.

export type CostCategoryOption = {
  value: string;
  label: string;
  // The Phosphor icon for this category, by name. A component turns it into an icon.
  icon: "ForkKnife" | "Car" | "Bed" | "Ticket" | "ShoppingBag" | "Receipt";
};

export const COST_CATEGORIES: CostCategoryOption[] = [
  { value: "food", label: "Food", icon: "ForkKnife" },
  { value: "transport", label: "Transport", icon: "Car" },
  { value: "lodging", label: "Lodging", icon: "Bed" },
  { value: "activities", label: "Activities", icon: "Ticket" },
  { value: "shopping", label: "Shopping", icon: "ShoppingBag" },
  { value: "other", label: "Other", icon: "Receipt" },
];

const NO_CATEGORY: CostCategoryOption = { value: "", label: "No category", icon: "Receipt" };

export function isCostCategory(value: string): boolean {
  return COST_CATEGORIES.some((category) => category.value === value);
}

// The category for a stored value, or "No category" with the Receipt icon for null.
export function costCategoryOf(value: string | null): CostCategoryOption {
  return COST_CATEGORIES.find((category) => category.value === value) ?? NO_CATEGORY;
}
