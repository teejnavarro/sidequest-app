# Sidequest design guide: Barkada with Open Road colors

Direction and colors picked by the owner on 2026-11-02. The Architect and Builder use this guide for
every screen. The clickable reference is `assets/mockups/barkada.html` (sample data only).

**Feel:** warm, friendly and ready to set off, like a group of friends planning a trip together. Money stays exact and
easy to read, even though the look is playful. Phone first, with both light and dark mode
following the phone's setting.

## Colors

Use these as named tokens in `src/app/globals.css`. Don't write other colors into screens.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `bg` | `#F3F7F9` | `#111A21` | Page background |
| `card` | `#FFFFFF` | `#1A2730` | Cards, tab bar, sheets |
| `ink` | `#1C2F3F` | `#EEF4F7` | Main text |
| `muted` | `#4F6475` | `#A9BAC6` | Supporting text |
| `line` | `#DDE6EB` | `#2E3D48` | Card edges and dividers |
| `chip` | `#EAF0F3` | `#25343F` | Quiet buttons and filters |
| `band` | `#304C64` | `#22384A` | Top header band |
| `on-band` | `#FFFFFF` | `#EEF4F7` | Text on the band |
| `band-muted` | `#C9DDE4` | `#BCD0DA` | Supporting text on the band |
| `amber` | `#F2A65A` | `#F2A65A` | Main button background only |
| `on-amber` | `#14232F` | `#14232F` | Text on the main button |
| `pin` | `#E08A2E` | `#F2A65A` | Route line plane only (decoration) |
| `blue-text` | `#24607A` | `#7FCFE0` | Times, selected tab, selected chip, tags |
| `blue-soft` | `#DCEBF0` | `#234956` | Selected chips, tags, the estimate card |
| `owed` | `#1F7A3D` | `#7EDB9A` | "You're owed" only |
| `owe` | `#B4321B` | `#FF9A8B` | "You owe" and errors only |
| `face-1` to `face-4` | `#FBDDBD`, `#CFE3EA`, `#CDEBDD`, `#D8DEF7` | `#6A4A24`, `#2C5364`, `#24574A`, `#38406E` | Initials circles |

Rules:
- Amber is the only warm accent. White text on amber is too hard to read, so the main button
  always uses dark text. No brown as a main color.
- Colors never carry meaning alone. The words "You're owed" and "You owe" are always there.
- The main text pairs above were checked and pass the WCAG AA reading standard (4.5:1 or better).
  The route line plane is decoration and don't need to meet it.
- The colors started from the Turquoise Amber Autumn palette in Figma's color palette library,
  then were softened.

## Type

| Role | Font | Size and weight |
|---|---|---|
| Page title | Bricolage Grotesque | 30px, bold (44px on the sign-in screen) |
| Section and card titles | Bricolage Grotesque | 19px and 17px, bold |
| Balance | Bricolage Grotesque | 30px, bold |
| Body | Manrope | 15px, regular |
| Supporting text | Manrope | 13px, regular |
| Tab labels | Manrope | 12px, medium |

- Load both fonts with `next/font/google`, including the `latin`, `latin-ext` and `vietnamese`
  subsets. They replace Geist.
- Both fonts were checked and include the peso sign (₱) and Vietnamese letters.
- All money uses lined-up digits (`font-variant-numeric: tabular-nums`).

## Shapes and spacing

- Corners: cards and sheets 20px, text boxes 12px, buttons, chips and tags fully round.
- Tap targets are at least 44px tall. Main buttons are 48px.
- Screens are one column: 480px wide at most on phones, 640px from 768px up, with a 16px side gutter.
- Cards have a thin border and no shadow.
- Pressing a button or trip card shrinks it slightly (`scale(.98)`), turned off when the phone
  asks for reduced motion. No other animation for now.

## Parts

- **Header band:** My trips and every trip page open with an ocean blue band. On My trips the
  first card overlaps its bottom edge slightly.
- **Route line:** trip cards show the dates as a small route: the start date, a dashed line
  with a plane flying right in the middle, then the end date.
- **Trip tabs:** bottom bar on phones with an icon and a label. From 768px they move to a
  rounded bar under the trip title.
- **Trip card:** name, route line, the person's own balance, and overlapping faces. The whole card taps.
- **Faces:** the Google photo when there is one, otherwise initials on a `face` color. A
  person's color stays the same everywhere.
- **Invite and join:** the invite page is a card with the link, Share link (main button, only where the phone can share) and Copy link, then a Who's in list. The join page is one card: trip name, "Trip owner", and one main button (Continue with Google, then Join trip).
- **Face stack:** overlapping photo or initials circles, at most five and then a "+n" circle. Used on the landing page, My trips cards (about 32px), the trip header and the join page. Before sign-in the circles on the join page are decoration only, with no names or alt text.
- **Review step:** a sheet from the bottom with a plain sentence ("Bea paid ₱3,000, split 4
  ways = ₱750 each.") plus Go back and Save.
- **Forms:** the label sits above the box, help text below it, errors below that in `owe`.
- **Empty screens:** say what to do next and include the button for it.
- **Loading:** grey shapes the size of the coming content, not spinners.
- **One main button per screen.** Everything else uses `chip`.
- **Times:** always say whose time it is on flights ("08:15 Manila time").

## Icons

Phosphor, bold weight (`@phosphor-icons/react`, to be installed by the Builder). One icon family only.
Votes use its thumbs-up and thumbs-down icons in place of the 👍/👎 emoji, so they look the
same on every phone.

## Words

Short and plain. Buttons start with a verb ("Log a cost"). Sentence case. Say "You're owed" and
"You owe", never "balance: +1400". No exclamation marks on system messages.

## Open for the Architect

- `project-context.md` lists shadcn/ui as the planned base. Plain Tailwind with these tokens
  may be enough. Decide and explain this when planning SQ-003.
- Screens not in the mockup yet (settle-up with QR codes, payment details, Trip Wrapped) follow
  this guide and get a design check when they are planned.
