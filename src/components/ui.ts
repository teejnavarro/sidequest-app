// Shared class strings so every screen looks the same (see docs/design.md).
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-text";
const press =
  "transition-transform active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";
const button = `inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap disabled:opacity-60 ${focus} ${press}`;

// One main button per screen: amber with dark text, 48px tall.
export const primaryButton = `${button} min-h-12 bg-amber px-[22px] text-on-amber`;
// Everything else: quiet, never shorter than 44px.
export const quietButton = `${button} min-h-12 bg-chip px-[22px] text-ink`;
export const smallQuietButton = `${button} min-h-11 bg-chip px-4 text-sm text-ink`;

export const inputClass = `min-h-12 w-full rounded-field border border-muted bg-card px-3.5 text-base text-ink ${focus}`;
// A dropdown: the same box as an input, with the native arrow removed. Put it in a
// `relative` wrapper with a caret icon that ignores pointer events, and leave room for it.
export const selectClass = `${inputClass} appearance-none pr-10`;
export const labelClass = "text-sm font-bold";
export const helpClass = "text-[13px] text-muted";
export const errorClass = "text-[13px] font-bold text-owe";

export const cardClass = "grid min-w-0 gap-2 rounded-card border border-line bg-card p-4";
export const linkClass = `inline-flex min-h-11 items-center gap-1 font-medium text-muted underline-offset-2 hover:underline ${focus}`;
export const pressCard = `${press} ${focus}`;

// A single phone-width column, 640px from 768px up, 16px side gutter. screenBase has no
// top padding, for a first card that overlaps the band; screenClass adds the usual 24px.
export const screenBase =
  "mx-auto grid w-full max-w-[480px] content-start gap-4 px-4 pb-8 md:max-w-[640px]";
export const screenClass = `${screenBase} pt-6`;

// For a destructive button such as Delete trip: the quiet look with the "owe" red text.
// Always used with words, never color alone.
export const dangerButton = `${button} min-h-12 bg-chip px-[22px] text-owe`;

// Small tags. Amber is only for the trip time on the trip header; the soft blue one is for
// trip cards and the Owner mark.
export const amberTag =
  "inline-flex items-center rounded-full bg-amber px-3 py-1 text-xs font-bold whitespace-nowrap text-on-amber";
export const softTag =
  "inline-flex items-center rounded-full bg-blue-soft px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-blue-text";

// Grey loading shape. It only pulses when the phone has not asked for less motion.
export const skeleton = "motion-safe:animate-pulse";

// The keyboard focus ring on its own, for things that are not buttons (a summary, a radio).
export const focusRing = focus;

// A filter or choice chip: quiet by default, soft blue when it is the chosen one. 44px tall.
export const chipClass = `inline-flex min-h-11 items-center gap-1.5 rounded-full bg-chip px-3.5 text-sm font-bold text-ink ${focus}`;
export const chipSelectedClass = `inline-flex min-h-11 items-center gap-1.5 rounded-full bg-blue-soft px-3.5 text-sm font-bold text-blue-text ${focus}`;
