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
export const labelClass = "text-sm font-bold";
export const helpClass = "text-[13px] text-muted";
export const errorClass = "text-[13px] font-bold text-owe";

export const cardClass = "grid min-w-0 gap-2 rounded-card border border-line bg-card p-4";
export const linkClass = `inline-flex min-h-11 items-center gap-1 font-medium text-muted underline-offset-2 hover:underline ${focus}`;
export const pressCard = `${press} ${focus}`;

// A single phone-width column, 640px from 768px up, 16px side gutter.
export const screenClass =
  "mx-auto grid w-full max-w-[480px] content-start gap-4 px-4 pt-6 pb-8 md:max-w-[640px]";

// For a destructive button such as Delete trip: the quiet look with the "owe" red text.
// Always used with words, never color alone.
export const dangerButton = `${button} min-h-12 bg-chip px-[22px] text-owe`;
