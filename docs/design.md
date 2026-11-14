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
- **Ideas:** filter chips on top (All with the total, then only the types in use with counts; the chosen one is soft blue), then one card per idea: name, a soft blue type tag with its icon, a meta row (clock and duration, coins and "about ₱120 each", pin and area) and a small face with "Added by <first name>". "Notes and link" opens inside the card with the notes, the link button and Edit idea. One main button, "Add an idea". The idea form is grouped as the idea, Type and How long as round radio choices, then an Optional group.
- **Votes and approval:** under each idea, a thumbs-up and a thumbs-down button (Phosphor, bold; filled when it is your vote) with their counts, at least 44px tall. Your own vote is soft blue; the others are `chip`. Counts show, never who voted. Tapping your current vote takes it back and the other thumb switches it. The count changes at once and the card stays put until the tab is opened again. On the right is a quiet "Approve" button, or "Move back" on an approved idea.
- **Approved ideas:** a second list at the top of the Ideas tab titled "Approved, not yet scheduled" with its count, above "Ideas" with its count and "most liked first". Approved cards have a `blue-text` border and a tag "Approved by <first name>" with a check, in `blue-text` with `card` colored text so it reads in light and dark. Type filters apply to both lists, and a list with nothing in it is left out. Voting continues on approved ideas. Scheduled ideas leave the Ideas tab; when every idea is on the schedule, the empty card says "Every idea is on the schedule." with the Add an idea button, and "No ideas yet" stays for a trip with no ideas at all.
- **Schedule:** one card per trip day: the date ("Sat, May 8") in the display font with a muted "Day 1" on the right, then one row per item. A row has the "when" in `blue-text` (bold, `tabular-nums`: Full day, Morning, 19:30), the name, and a small muted line: a lightbulb and "From ideas" for an idea item or the notes for a new one, then "Last changed by <first name>". The whole row taps to Move item (at least 44px). Empty days say "Nothing planned yet." Today's card has a `blue-text` 2px edge and a soft blue "Today" tag in place of "Day N", and the tab scrolls to it. Items outside the trip dates collect in a last card, "Needs a new day". One main button, "Add to schedule".
- **Schedule chips:** Add to schedule and Move item pick the day ("Sat 8") and the "when" (Full day, Morning, Afternoon, Evening, Exact time) with the same round radio chips as the idea form. The time box appears only when Exact time is chosen and is labelled with the place's clock, "Time (Vietnam time)". Approved ideas are picked from a list of rows (type icon and name; the chosen one has a `blue-text` edge and a soft blue fill). A round two-part switch on Add chooses "Approved idea" or "Something new". It opens on "Approved idea" when there is one to pick (or the address asks for it), and on "Something new" otherwise.
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
- **U6 Join page:** a small Sidequest wordmark, one line saying what Sidequest is, and "After signing in, tap Join trip." under the button. Keep "You're invited to" when signed in, and keep the "Trip owner" line. The privacy rule stands: no names beyond the owner before sign-in.
- **U7 Words:** Schedule: "One card per day, so nobody has to ask what time." Ideas: "Every "we should totally go here" in one place." Bookings: "Flights and stays, so no one digs through the group chat at the airport." Costs: "Who paid, who owes, and no awkward chats about it." "Display name" becomes "Your name". Time zone help: "Times in the plan use this place's clock." All 17 currencies read as name and symbol, such as "Philippine peso (₱)". Date errors: "Pick the day you leave." and "Pick the day you're back." Date ranges use an en dash. Errors use "couldn't" throughout.
- **U8 Polish:** loading shapes match the real content and respect reduced motion; dropdown text lines up with other boxes, with more room for the arrow; no empty reserved space under Save; each page has its own browser title; photos get a `chip` background while loading and a sharper image size.

## Open for the Architect

- `project-context.md` lists shadcn/ui as the planned base. Plain Tailwind with these tokens
  may be enough. Decide and explain this when planning SQ-003.
- Screens not in the mockup yet (settle-up with QR codes, payment details, Trip Wrapped) follow
  this guide and get a design check when they are planned.

## Guests (SQ-005, owner-approved in Lavish 2026-11-10)

- **Guest tag:** a guest in the people list on Invite people has a circle with initials on the `chip` color (no account color, no photo), the name, a muted "Added by <first name>" line under it, and a quiet `Guest` tag (`chip` background, `muted` text, same shape as the Owner tag). The Owner tag keeps its soft blue. A guest's row is a link to Edit guest (at least 44px tall, with a caret) only for the person who added the guest and the trip owner; for everyone else it is plain. After a guest is claimed, the spot shows the person's own name and photo like any member.
- **Add a guest:** under the people list, a "Add a guest" label, the help line "For friends who won't sign up. They can take over their spot later by joining with the link.", a name box labelled "Guest's name" and a quiet Add button on the same row. Errors appear under the box in `owe`.
- **Edit guest and Remove guest:** task pages with the short band and a back link to Invite people. Edit has a Name box and "Save changes" as the main button, a red "Remove guest" text link, and a muted line "A guest who's part of any costs can't be removed." Remove asks "Remove <name>?", with "Keep guest" as the main (amber) button and a red "Remove guest" button.
- **The guest question:** on the join page, only for a signed-in person when the trip has unclaimed guests. A group titled "Are you already on this trip as a guest?" with one option per guest ("Yes, I'm <name>", small initials circle) and "No, I'm new to this trip", none chosen. The chosen option gets a 2px `blue-text` edge. Help line: "Picking your name keeps everything already added for you." The main button reads "Join as <name>" once a name is picked and "Join trip" otherwise. With no guests the page is exactly as before. Signed out, guests are only circles in the count, with no names.

## Shared costs (SQ-013, owner-approved in Lavish 2026-11-10)

- **Costs tab:** a "Logged so far" card with the total and "<n> costs. Who owes whom comes soon.", an amber "Log a cost" button, then one card of costs grouped under day headings, newest first. Each row is a link of at least 44px high: a `blue-soft` circle with the category icon, the description (wraps), the amount right-aligned, and a muted line "<You or name> paid, split <n> ways, your share <amount>" or "you're not in this one", then "Added by <name>" and, when someone else changed it, "edited by <name>". Empty: "No costs yet. Log the first one: who paid, and who shares it."
- **Log a cost and Edit cost:** task pages with the short band. "What was it?", "Amount" with the currency symbol inside the box (no decimals for yen, won and dong), "Who paid?" as round radio chips, "Split equally between" as checkbox chips with faces and the Guest tag (a ticked chip also shows a check mark, not just a color), Date, "Category (optional)". Edit adds a red "Delete cost" text link.
- **Review step:** replaces the form on the same page. A `blue-soft` summary "<payer> paid <amount>, split <n> ways", one line per person with their share, a Total line, and the extra-piece sentence only when the split is uneven. For an edit, only changed fields show, as before (struck through), an arrow, then after, plus "Nothing else changed." Main button "Save cost" or "Save changes", and a quiet "Change something" that keeps every value.
- **Delete cost:** "Delete <description>?", "This deletes it for everyone. You can't undo this.", "Keep cost" as the amber main button and a red "Delete cost" below it.
- **Edit guest and Delete trip:** a guest in any cost shows "<name> is part of <n> costs, so they can't be removed." in place of the Remove guest link. Delete trip adds "This also deletes <n> costs." only when the trip has costs.

## Members (SQ-006, owner-approved in Lavish 2026-11-14)

- **Invite people:** for the owner only, every other person's row (not guests, not the owner's own) is a link of at least 44px with a caret and the label "Manage <name>", going to the Member page. Guests keep their Edit guest link. Members see plain rows, as before. Under Share and Copy in the link card, the owner sees a muted underlined "Get a new link" with the arrows-clockwise icon.
- **Member page:** task page with the short band (back to Invite people, the person's name as the title). One card: a 56px face and the name, then a muted "Part of <n> costs" only when n is above 0 ("1 cost" for one). A quiet button with the crown icon, "Make <first name> the owner", and below the card a red "Remove from trip" text link.
- **Make owner:** "Make <first> the owner?" with "<First> will manage people, the invite link and deleting the trip. You stay in the trip as a member. Only <First> can hand it back." The amber button is the action itself, "Make <first> the owner", with a quiet "Go back" link under it. This is the one confirm page where amber is the action, because nothing is lost.
- **Remove member:** "Remove <first> from the trip?", "<First> won't see this trip anymore. Costs <First> is part of stay, marked "left the trip"." and a muted line "<First> could rejoin with the invite link. Get a new link afterwards if you don't want that." "Keep <first>" is the amber button, "Remove from trip" is the red button.
- **New invite link:** "Get a new invite link?", "The old link stops working right away. Anyone who hasn't joined yet will need the new one." "Keep this link" is the amber button, "Get a new link" is a quiet button (a mis-tap would break a link already shared).
- **Edit trip and Leave trip:** a member who is not the owner sees a red "Leave trip" text link on Edit trip, which opens a confirm page: "Leave <trip name>?", "You won't see this trip anymore. Costs you're part of stay, marked "left the trip".", muted "To come back, you'll need the invite link.", "Stay in trip" amber, "Leave trip" red. The owner has no Leave trip; when another person is in the trip, Edit trip shows a muted line "To leave, make someone else the owner first. You can do that on Invite people." with the link.
- **People who left:** they appear only inside costs. The Costs tab reads "<Name> (left the trip) paid" with the bracketed words in muted text. In the cost form, a person who left shows a small "Left" tag like the Guest tag, and is offered only on a cost they are already in. People who left are not listed on Invite people, My trips or the join preview. A person who left and opens the invite link skips the guest question: Join trip puts them back in the same place, with the same costs.
