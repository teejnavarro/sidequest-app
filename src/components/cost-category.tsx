import { Bed, Car, ForkKnife, Receipt, ShoppingBag, Ticket } from "@phosphor-icons/react/dist/ssr";
import { costCategoryOf, type CostCategoryOption } from "@/lib/cost-options";

const ICONS = {
  ForkKnife,
  Car,
  Bed,
  Ticket,
  ShoppingBag,
  Receipt,
} satisfies Record<CostCategoryOption["icon"], unknown>;

// The icon for a cost category (Receipt for none), always decorative: the cost's words sit
// next to it.
export function CostCategoryIcon({ category, size = 20 }: { category: string | null; size?: number }) {
  const Icon = ICONS[costCategoryOf(category).icon];
  return <Icon size={size} weight="bold" aria-hidden="true" className="shrink-0" />;
}
