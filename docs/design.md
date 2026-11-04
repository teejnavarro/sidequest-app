# Sidequest design guide: Barkada with Open Road colors

Direction and colors picked by the owner on 2026-11-02, refined on 2026-11-04. The Architect and Builder use this guide for
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
| `band` | `#1F5A78` | `#1B4A63` | Top header band |
| `on-band` | `#FFFFFF` | `#EEF4F7` | Text on the band |
| `band-muted` | `#D3E8EF` | `#C4DBE5` | Supporting text on the band |
| `amber` | `#F2A65A` | `#F2A65A` | Main button background, and the trip time tag on the trip header |
| `on-amber` | `#14232F` | `#14232F` | Text on the main button and trip time tag |
| `pin` | `#E08A2E` | `#F2A65A` | Route line plane only (decoration) |
| `blue-text` | `#24607A` | `#7FCFE0` | Times, selected tab, selected chip, tags |
| `blue-soft` | `#DCEBF0` | `#234956` | Selected chips, tags, the estimate card |
| `owed` | `#1F7A3D` | `#7EDB9A` | "You're owed" only |
| `owe` | `#B4321B` | `#FF9A8B` | "You owe", errors, and the text of a destructive button such as Delete trip (always with words) |
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

## Approved refinements (2026-11-04)

The screens should feel specific to friends planning a trip, not like a generic app. The owner approved these in Lavish, including the build details on 2026-11-04, and the color table above already shows the new header and amber values. Layouts stay fluid and are checked on a real iPhone and Samsung.

- **U1 Trip header:** about 205px tall on a phone. Back link and a small pencil for Edit trip, the trip name, then a pin icon with "China · Nov 3–6, 2026 · GMT+8" (with no destination: no pin, and "Nov 3–6, 2026 · GMT+8 Philippines"). Faces with "3 going", or "Just you so far" when alone. These replace the Owner line. Invite people is the one pill.
- **U2 Trip time:** a tag saying "In 12 days", "Tomorrow", "Day 2 of 4", "Today" (one-day trips) or "Trip's over", worked out from the stored dates in the trip's own time zone. Amber on the trip header, soft blue on trip cards.
- **U3 My trips card:** the first card really overlaps the band, as Parts says. "You + 2", or "Just you so far", sits beside the faces.
- **U4 New trip form:** fields grouped as The trip, When and Details. Trip name shows example hint text. Dates are labelled Leaving and Back, and sit side by side from 360px wide (stacked below that). Destination is labelled "Where to? (optional)". A live route line appears once dates are set. New trip and Profile get the band.
- **U5 Task pages:** Edit, Invite and Delete use a short band whose back link returns to the trip, with no tab bar. The invite link shows on one shortened line, and the full link is what gets copied. "3 people are in" and a quiet Owner tag replace "Who's in (3)" and "(owner)".
- **U6 Join page:** a small Sidequest wordmark, one line saying what Sidequest is, and "You'll join the trip right after signing in." under the button. Keep "You're invited to" when signed in, and keep the "Trip owner" line. The privacy rule stands: no names beyond the owner before sign-in.
- **U7 Words:** Schedule: "One card per day, so nobody has to ask what time." Ideas: "Every "we should totally go here" in one place." Bookings: "Flights and stays, so no one digs through the group chat at the airport." Costs: "Who paid, who owes, and no awkward chats about it." "Display name" becomes "Your name". Time zone help: "Times in the plan use this place's clock." All 17 currencies read as name and symbol, such as "Philippine peso (₱)". Date errors: "Pick the day you leave." and "Pick the day you're back." Date ranges use an en dash. Errors use "couldn't" throughout.
- **U8 Polish:** loading shapes match the real content and respect reduced motion; dropdown text lines up with other boxes, with more room for the arrow; no empty reserved space under Save; each page has its own browser title; photos get a `chip` background while loading and a sharper image size.

## Open for the Architect

- `project-context.md` lists shadcn/ui as the planned base. Plain Tailwind with these tokens
  may be enough. Decide and explain this when planning SQ-003.
- Screens not in the mockup yet (settle-up with QR codes, payment details, Trip Wrapped) follow
  this guide and get a design check when they are planned.
