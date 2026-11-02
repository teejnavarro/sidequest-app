// A person's circle color is picked from their id, so it is the same everywhere.
export const FACE_COUNT = 4;

export function faceColorIndex(userId: string): number {
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash % FACE_COUNT;
}

const CLASSES = ["bg-face-1", "bg-face-2", "bg-face-3", "bg-face-4"];

export function faceColorClass(userId: string): string {
  return CLASSES[faceColorIndex(userId)];
}

// Up to two letters, safe for names with accents and emoji.
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0]);
  return letters.join("").toUpperCase() || "?";
}
