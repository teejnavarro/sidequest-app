import {
  Binoculars,
  DotsThreeCircle,
  ForkKnife,
  Martini,
  Mountains,
  ShoppingBag,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { ideaTypeOf, type IdeaTypeOption } from "@/lib/idea-options";

const ICONS = {
  ForkKnife,
  Binoculars,
  Mountains,
  Sparkle,
  ShoppingBag,
  Martini,
  DotsThreeCircle,
} satisfies Record<IdeaTypeOption["icon"], unknown>;

// The icon for an idea type, always decorative: the type's name sits next to it as text.
export function IdeaTypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  const Icon = ICONS[ideaTypeOf(type).icon];
  return <Icon size={size} weight="bold" aria-hidden="true" className="shrink-0" />;
}
