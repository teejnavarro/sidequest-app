import Image from "next/image";
import { User } from "@phosphor-icons/react/dist/ssr";
import { FORMER_MEMBER_NAME } from "@/lib/display-name";
import { faceColorClass, initialsOf } from "./face-color";

type FaceProps = {
  userId: string;
  name: string;
  image: string | null;
  size?: number; // pixels
  // Pure decoration: empty alt text and hidden from screen readers, so the person's
  // name is nowhere in the page. The photo or initials are still visible.
  decorative?: boolean;
  // A guest has no account color: a quiet chip circle with initials.
  neutral?: boolean;
};

// The Google photo when there is one, otherwise initials on the person's color. A deleted
// account (no photo) gets a quiet circle with a person icon, so it never looks like a friend.
export function Face({ userId, name, image, size = 32, decorative = false, neutral = false }: FaceProps) {
  const box = { width: size, height: size };
  if (image) {
    return (
      <Image
        src={image}
        alt={decorative ? "" : `${name}'s photo`}
        width={size}
        height={size}
        style={box}
        className="shrink-0 rounded-full bg-chip object-cover"
      />
    );
  }
  const former = name === FORMER_MEMBER_NAME;
  return (
    <span
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": name })}
      style={{ ...box, fontSize: Math.round(size * 0.36) }}
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold ${former ? "bg-chip text-muted" : neutral ? "bg-chip text-ink" : `text-on-face ${faceColorClass(userId)}`}`}
    >
      {former ? <User size={Math.round(size * 0.55)} weight="bold" aria-hidden="true" /> : initialsOf(name)}
    </span>
  );
}
