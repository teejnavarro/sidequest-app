import Image from "next/image";
import { faceColorClass, initialsOf } from "./face-color";

type FaceProps = {
  userId: string;
  name: string;
  image: string | null;
  size?: number; // pixels
};

// The Google photo when there is one, otherwise initials on the person's color.
export function Face({ userId, name, image, size = 32 }: FaceProps) {
  const box = { width: size, height: size };
  if (image) {
    return (
      <Image
        src={image}
        alt={`${name}'s photo`}
        width={size}
        height={size}
        style={box}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      style={{ ...box, fontSize: Math.round(size * 0.36) }}
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-on-face ${faceColorClass(userId)}`}
    >
      {initialsOf(name)}
    </span>
  );
}
