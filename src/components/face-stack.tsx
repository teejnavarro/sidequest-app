import { Face } from "./face";

export type StackPerson = { id: string; name: string; image: string | null };

const MAX_FACES = 5;

type FaceStackProps = {
  people: StackPerson[];
  size?: number; // pixels, without the border
  // The border color should match what the circles sit on, for example "border-card".
  borderClass: string;
  // Decoration only: no names or alt text anywhere (used before sign-in).
  decorative?: boolean;
};

// Overlapping circles, like the landing page. At most five faces, then a "+n" circle.
export function FaceStack({ people, size = 32, borderClass, decorative = false }: FaceStackProps) {
  if (people.length === 0) return null;

  const shown = people.slice(0, MAX_FACES);
  const extra = people.length - shown.length;
  const ring = `inline-flex shrink-0 rounded-full border-2 ${borderClass} -ml-2 first:ml-0`;

  return (
    <span className="inline-flex items-center" {...(decorative ? { "aria-hidden": true } : {})}>
      {shown.map((person) => (
        <span key={person.id} className={ring}>
          <Face
            userId={person.id}
            name={person.name}
            image={person.image}
            size={size}
            decorative={decorative}
          />
        </span>
      ))}
      {extra > 0 ? (
        <span className={ring}>
          <span
            style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
            className="inline-grid shrink-0 place-items-center rounded-full bg-chip font-bold text-ink"
            {...(decorative ? {} : { role: "img", "aria-label": `and ${extra} more` })}
          >
            +{extra}
          </span>
        </span>
      ) : null}
    </span>
  );
}
