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

- **Costs tab:** a balance card (see Balances and uneven splits below), an amber "Log a cost" button, then one card of costs grouped under day headings, newest first. Each row is a link of at least 44px high: a `blue-soft` circle with the category icon, the description (wraps), the amount right-aligned, and a muted line "<You or name> paid, split <n> ways, your share <amount>" or "you're not in this one", then "Added by <name>" and, when someone else changed it, "edited by <name>". Empty: "No costs yet. Log the first one: who paid, and who shares it."
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

## Balances and uneven splits (SQ-014, owner-approved in Lavish 2026-11-17)

- **Balance card (Costs tab):** replaces "Logged so far". A muted bold "Your balance for this trip", then a 30px display line: "You're owed <amount>" in `owed`, "You owe <amount>" in `owe`, or "All settled" with a Phosphor `Check` in ink (never the check emoji). Under it a muted "<total> logged in <n> costs", and a quiet full-width pill link "See who owes whom" with a caret. Colors never carry the meaning alone: the words always say it.
- **Balances page:** task page with the short band, back to Costs. A "Settle up" card ("The fewest payments to make everyone even.") with one row per payment: a 36px face of the payer, "<Payer> pays <receiver>" ("you" for the viewer, "(left the trip)" in muted after a left person), the amount right-aligned in lined-up digits. The viewer's payments come first. Under the list, a muted "Paid someone back? Marking it here comes in a later update." When nothing is owed: "Everyone's even. Nothing to pay." Then an "Everyone's balance" card: face, name (Guest tag, "(left the trip)"), a second line "is owed", "owes" or "is settled", the amount right-aligned. The viewer comes first and is the only row colored (`owed` or `owe`, with "You're owed" or "You owe"). A trip with no costs shows one "No costs yet." card with a link back to Costs and no amber button.
- **My trips card:** between the route line and the faces, a bold line with the same wording as the balance card at 15px. Nothing for a trip with no costs. Balances are never added across trips.
- **Edit trip:** once a trip has costs the currency box is disabled and its help line reads "Can't change once costs are logged, including any in the trash."
- **Uneven split (Log a cost and Edit cost):** the legend is "Split between". Under the chips a quiet blue-text button "Not an even split? Add what each person had" with a caret (at least 44px) opens a chip-colored panel: the help line "Leave a box empty if they only share the rest.", then one row per ticked person (28px face, name, Guest or Left tag, currency symbol, a right-aligned amount box). A live line under the boxes, soft blue "<rest> left over, shared equally: <each> each" (or "Nothing left over."), turns red "That's <x> more than the total." when the boxes add up to more. Server errors show under the panel in `owe`. An uneven cost reopens with the panel open and every person's full share in their box.
- **Review of an uneven cost:** the summary is "<payer> paid <amount>, split <n> ways" with no "each". Each person's line has a muted second line "<own> own + <shared> shared" (or "<shared> shared"). The extra-piece sentence talks about the left-over part only.

## Costs extras (SQ-015, SQ-016, SQ-018, owner-approved in Lavish 2026-11-23)

- **Currency box (Log a cost and Edit cost):** the Amount row is `[currency select][amount box]`. The select is a normal input box with a caret (like the category select), label "Currency", options "<symbol> <CODE>" with the trip currency first. The amount placeholder, keyboard and the own-amount symbols follow the picked currency. A trip-currency cost looks and works as before, with no panel.
- **Other-currency panel:** picking another currency opens a chip-colored panel under the amount. A two-part switch (real radios, round, ticked part soft blue): "Use a rate" and "Card charged pesos" ("Card charged <CODE>" when the trip currency is not pesos). Rate side: label "Rate", a row "₱1 = ₫ [box]" (decimal, placeholder 435). Card side: label "Pesos charged" ("<CODE> charged"), the trip symbol and a box, help "From your card or bank app." A soft-blue line under them says "That's ₱2,000.00" or "Works out to ₱1 = ₫431.70", and is hidden until the boxes make sense. It is a helper only: the server works it out again on Review and Save. A new cost starts in the currency you used last in this trip, with the latest rate for it filled in.
- **Uneven helper:** it uses the same rule as Save. When Save would refuse (more than the total, a share of 0, a left-over that can't be shared), the line turns red (`card` background, `owe` text) and says the same words Save would.
- **Review:** the summary stays in the trip currency. A muted line under it: "₫870,000 at ₱1 = ₫435", or "₫3,200,000, card charged ₱7,412.60 (₱1 = ₫431.70)". Each person's line has a muted small original under the name ("₫217,500", or "₫300,000 own + ₫67,500 shared" on an uneven split), and Total has the original under it. An edit review lists a changed original amount, "Amount in <CODE>" and "Rate" as before, then after.
- **Costs tab:** the amount cell has a muted second line with the original amount for a foreign cost. Under the costs card a row of quiet `linkClass` links with Phosphor icons: "Trash (n)" (`Trash`, only when the trash has something, also shown on the "No costs yet." card) and "Download costs (CSV)" (`DownloadSimple`, a plain link that downloads, hidden when there are no costs).
- **Delete cost:** same page. The body now reads "It moves to the trash for everyone and stops counting in balances. Anyone in the trip can put it back." Keep cost stays amber, Delete cost stays red.
- **Trash page:** task page, back "Costs", title "Trash". One card: muted help "Deleted costs don't count in balances. Anyone in the trip can put one back." Each row has the category circle, the description (wraps), the amount right-aligned with a muted original, a muted "Deleted by <Name or you> · Mon, Nov 23, 14:05" (the trip's time zone, 24-hour) and a small quiet "Restore" button. No question before restoring: nothing is lost. Newest deletion first. Empty: "Nothing in the trash." and "Deleted costs land here, so a wrong tap is never final."
- **Trash wording elsewhere:** Edit trip help: "Can't change once costs are logged, including any in the trash." Delete trip: "This also deletes 5 costs, including 1 in the trash." Edit guest: "Dana is part of 2 costs (1 in the trash), so they can't be removed." Member page: "Part of 2 costs (1 in the trash)". The bracketed parts show only when something is in the trash.
- **CSV file:** one row per cost, one column per person, a TOTAL row that matches the Costs tab. Spec in `.gsd/costs-extras-spec.md` section 7.

## Payments (SQ-019, SQ-020, owner-approved in Lavish 2026-11-24)

Reference: `.lavish/payments-alignment.html`. Receipts and QR images are always `<img>` tags pointing at the private image routes, never `next/image` and never a storage address.

- **Profile, Payment details card:** under the name card, before Sign out. A 19px title, muted help "Friends in your trips see these when they pay you back. Only add where you receive money. Never card numbers, PINs or codes." Each saved account is a link row (at least 56px, caret) with a 40px `blue-soft` circle holding a Phosphor icon (`DeviceMobile` for GCash and Maya, `Bank` for a bank), a bold label (GCash, Maya or the bank name) and a muted line "0917 123 4567 · Ben C. · QR added". A bank shows only "•••• 3456" here. Under the rows a quiet full-width "Add payment details" with `Plus`, hidden at 10 accounts. Empty: "Add your GCash, Maya or bank details so friends can pay you back without asking." with the same button.
- **Add and Edit payment details:** task pages back to Profile. "Type" as round chips GCash, Maya, Bank. Bank only: a "Bank" box with a list of suggestions ("Type it or pick from the list."). "Account name" ("As it shows in your app." or "As it shows in your bank app."). The number box is labelled "GCash number", "Maya number" or "Account number" and opens the number keypad. "QR image (optional)" is a dashed full-width button "Add a QR image" with `QrCode`; once a picture is picked or saved it becomes a 64px preview with quiet "Change" and "Remove" buttons. The one amber button is "Save details". Edit adds a red text link "Delete these details" to a confirm page ("Delete your BPI details?", "People in your trips won't see them anymore."; "Keep details" amber, "Delete details" red).
- **Pictures:** the phone shrinks every picked picture to a JPEG of at most 1280px before it uploads. If it can't be read: "Couldn't read that image. Try a screenshot instead."
- **Balances, Settle up:** every row is a link (at least 48px, caret) to the Pay page. Help: "The fewest payments to make everyone even. Tap one to see how to pay." This replaces the old "Marking it here comes in a later update." line.
- **Balances, Payments card:** after Settle up, only when something was paid back. Rows with the payer's 36px face, "You paid Ana" or "Bea paid you" (a left person is marked), the amount on the right, and a muted line with the method icon (`DeviceMobile`, `Bank`, `Money`), "GCash · Mon, Nov 24" in the trip's time zone, and "· Receipt" with `Image` only for the two people involved. The viewer's own payments are links to the Payment page, others are plain. Newest first.
- **Pay page:** task page back to Balances, titled "Pay Ana", "Bea pays you" or "Ben pays Ana". Card 1: a muted bold line ("You pay Ana") and the 30px display amount, in `owed` when the viewer is the receiver (with a line telling them which details the payer sees, and a link to Profile). Card 2, "Ana's details": one block per account with the icon, label, account name, the number in 22px lined-up digits with a small quiet "Copy" button (copies digits only, reads "Copied" for 2 seconds) and the QR at 220px, tap to open full size in a new tab. When there is nothing to show it says why: Ana hasn't added details, Dana is a guest, Ana left the trip. When the line is gone: "Nothing to pay here anymore. Balances changed." with a link back.
- **Mark it paid (payer or receiver only):** an "Amount" box with the line amount filled in ("Paying part of it? Lower the amount."), "How did you pay?" chips GCash, Maya, Bank, Cash, and "Receipt (optional)" as a dashed "Add a screenshot" button ("Only you and Ana can see it."). The one amber button is "Review". The review replaces the card contents on the same page (the form stays in the page, hidden, so the picked receipt is kept): a `blue-soft` summary ("You paid Ana ₱1,200.00 via GCash."), "₱300.00 still to pay." for a part payment, a small receipt line, muted "Balances update right away. You or Ana can delete it later.", an amber "Save payment" and a quiet "Change something". If the server refuses, its error shows in the form and the review closes. Too much: "That's more than you owe Ana (₱900.00). Lower the amount." (for the receiver "That's more than Bea owes you (₱450.00)...").
- **Payment page and Delete payment:** only for the payer and the receiver (anyone else gets "not found"). The payment page shows the sentence, "Tue, Nov 24, 14:05 · Recorded by you", the receipt (tap to open) with "Only you and Ana can see this receipt." and a red "Delete payment" text link. Delete asks "Delete "You paid Ana ₱300.00 via GCash"?", "Balances go back to before it, for everyone. The receipt is deleted too. You can't undo this." with "Keep payment" amber and "Delete payment" red.
- **Edit guest:** a guest in a payment can't be removed: "Dana is part of a payment, so they can't be removed." (joined with costs when both apply).

## Account and privacy (SQ-021, owner-approved in Lavish 2026-11-25)

Reference: `.lavish/account-alignment.html`.

- **Profile links:** under Sign out, stacked and centered, each at least 44px: a blue-text underlined "Privacy note" with `ShieldCheck` and a red underlined text link "Delete my account" (14px bold). Both are plain links, no buttons.
- **Delete my account page:** task page back to Profile, titled "Delete my account". Two states, chosen fresh on every visit.
  - **State A, a shared trip is still yours:** one card "First, hand over your trips" with muted help "Other people are in these trips, so someone needs to look after them. Make someone else the owner, then come back here." One link row per trip (at least 56px, caret): a 40px `blue-soft` circle with `Crown`, the bold trip name, muted "You + 2 · Make someone else the owner". It goes to that trip's Invite people page. Under the card a centered muted "Delete my account opens once no trip is left here." There is no red button in this state.
  - **State B, ready:** one card "Delete your account?" with a list of `XCircle` (in `owe`) lines: "Your name, email and photo", "Your payment details and QR images", "Receipts you uploaded", then one line per trip only you are in: bold trip name, ", since only you are in it" and " (2 costs)" only when it has costs. A divider, then a `CheckCircle` (in `blue-text`) line "Costs and payments stay in your trips under "Former member", so everyone's balances still add up." Then, for each trip where you still owe, a `chip` note with `Info`: "You still owe ₱850.00 in Baguio weekend. That stays on the trip's balances." Muted "You can't undo this. Signing in again later starts a new, empty account." Last, the amber "Keep my account" link and the red "Delete my account" button, same pattern as Delete trip.
- **After deleting:** the sign-in page shows a muted line "Your account is deleted." above the Google button.
- **Sign-in page:** a small muted underlined "Privacy note" link under the Google button.
- **Former member:** the name is "Former member" and nobody can pick it as their own name. Where left people already get "(left the trip)" it reads "Former member (left the trip)". The face is a `chip` circle with a muted `User` icon, never initials. The Pay page says "This person deleted their account, so there are no details to show."
- **Privacy note page (`/privacy`, public):** task band titled "Privacy note", back link "Profile" when signed in and "Sidequest" when signed out. Four cards (19px titles): "What Sidequest keeps", "Who sees it", "Where it lives", "Deleting your account", then a muted line "Questions? Ask the person who invited you, or Sidequest's maker on GitHub." (GitHub links to the public repo) and a muted "Updated 25 November 2026." Change the date whenever the words change.

## Cost breakdown and balance list (SQ-035, owner-approved in Lavish 2026-11-27)

Reference: `.lavish/cost-breakdown-alignment.html` and `.lavish/balance-adds-up-alignment.html`. No new tokens.

- **Cost page (`/trips/[tripId]/costs/[costId]`):** task page, back "Costs", title "Cost", no tab bar. Tapping a Costs tab row opens it (the row looks the same; it used to open Edit). Not found for non-members, trashed costs and unknown ids.
- **Hero card:** a 44px `blue-soft` circle with the category icon on the left; every line sits in the right column: the description (19px display, wraps), the amount (30px display, lined-up digits), for a foreign cost one muted line "₫2,000,000 at ₱1 = ₫435 · ₱4,597.70" (or "₫2,000,000, charged as ₱4,620.00" when no rate was stored), then "Thu, May 6 · Lodging" (day only with no category).
- **People card:** the payer row (36px face, bold "Ana paid ₱3,000.00" or "You paid ₱4,600.00"; an uneven cost adds a quiet `chip` tag "Not an even split" beside it). Under it a tree: a 2px `line` rule with short ticks and one row per share (28px face, words, amount right, at least 44px). The viewer first, then others in trip order, the payer's own share last. "You owe" (in `owe`, the only colored row), "Bea owes", "Ana's share" / "Your share". Guest tag, muted "(left the trip)" and "Former member" as on Balances. A foreign cost adds a muted second line with the share in the original currency. A viewer not in the cost sees a muted "You're not in this one." Then a `chip` note with `Info`: "For this cost only. Payments and other costs are on Balances." (Balances is a link).
- **History card:** "Added by Bea · Fri, May 7, 20:40" (`PlusCircle`) and, only when edited, "Last edited by Ana · Sat, May 8, 09:02" (`PencilSimple`). "you" for the viewer; times in the trip's time zone.
- **Actions:** a quiet full-width "Edit cost" pill with `PencilSimple`, then a red "Delete cost" text link. No amber button. Saving an edit returns to this page, Edit's back link ("Cost") returns here, and Delete's "Keep cost" returns here.
- **Balances, "How your balance adds up":** a card directly under Settle up. One line per cost the viewer paid or shares, newest first: a 36px `blue-soft` category circle, the bold description, muted "Dan paid ₱3,802.00 · May 8" ("You paid ..."), and on the right a muted small label over a bold amount: "you owe ₱950.50" or "owed to you ₱187.50". Each cost line opens its Cost page (at least 44px). Lines that add ₱0.00 are left out. Then a muted "Payments" subheading with "You paid Dan" / "Bea paid you", method and day, and "paid back ₱500.00" / "got back ₱500.00" (left out when none). A total row under a 2px `ink` rule: "Your balance", then "You owe ₱1,013.00" (`owe`), "You're owed ₱2,789.00" (`owed`) or "All settled" with the check. Only the total is colored. Every line shows, no collapsing; the card is left out when the viewer has no costs or payments. The lines add up to the viewer's Everyone's balance figure exactly.
- **Settle up help:** "The fewest payments to make everyone even, so you might pay someone who didn't pay for your cost. Tap one to see how to pay."

## Homepage (SQ-034, owner-approved in Lavish 2026-11-25)

Reference: `.lavish/homepage-story-alignment.html`. No new tokens.

- **Idea:** the homepage is a boarding pass. Each step of using the app is a ticket on the dashed route line that trip cards already use. A visitor sees what Sidequest is in one line, follows one made-up trip from start to settle-up, then signs in (or goes to My trips). Signed-in people see the same page.
- **Hero band:** the "Sidequest" wordmark top left, and a small "My trips" pill top right only when signed in. Headline "Your trip, out of the group chat." (40px phone, 64px desktop, `on-band`) and the muted line "Plan trips together and split costs without the awkward chats."
- **Hero pass:** a card that overlaps the band's bottom edge (about 64px phone, 84px desktop). Main part: "From / The group chat", "To / One plan", a small route row "Ideas - plane - Settled up". Signed out: "Your account is deleted." (muted, only with `?deleted=1`), the amber Continue with Google, a muted "Free. Sign in, start a trip, send the link." and the Privacy note link. Signed in: the amber "Go to My trips" and "Welcome back. Your trips are one tap away." Stub past a tear line (below on phone, right on desktop): "Passengers" with four decorative faces (BA, MI, JO, RI) and "and your friends", "Stops 6", "Boarding / Anyone with the link".
- **The journey:** a dashed `blue-text` line down the left with the `pin` plane on it. Three legs, each an amber dot, a small uppercase "Leg 1" in `blue-text` and a 22px title: "Before the trip", "During the trip", "After the trip".
- **Step ticket:** a soft blue "Step 01" tag, the headline (24px phone, 34px desktop), one muted line, a dashed tear line with half-circle notches (they use `bg` so they read in light and dark), then the screenshot on a `chip` panel, phone-framed (6px `ink` border, no bottom border) and cropped at the bottom edge. Phone: the ticket stands up, indented 44px from the route line. From 768px: it lies sideways, about 380px tall, words left, vertical tear line, screenshot right, indented 60px.
- **The six steps (headline, then line):**
  - 01 "Start a trip in a minute." / "Give it a name and dates, and the money's in pesos unless you say so."
  - 02 "One link for the group chat." / "Friends tap it and they're in. Friends who won't sign up can be added as guests."
  - 03 "Every "we should totally go here" in one place." / "Add ideas, vote them up or down, and approve the ones you're doing."
  - 04 "One card per day, so nobody has to ask what time." / "Approved ideas drop into their day, in the trip's own time zone."
  - 05 "Who paid, who owes, and no awkward chats about it." / "Log a cost in seconds. Split it evenly, or say what each person had."
  - 06 "Settle up with GCash, Maya or bank." / "Sidequest works out the fewest payments. Tap one to see their details and QR, then mark it paid."
- **How it's built (tools version, owner-approved in Lavish 2026-11-28, `.lavish/homepage-tools-ticket.html` layout A):** a ticket tagged "Behind the scenes", titled "How it's built", with the muted line "Free tools and services, so it runs for ₱0 a month. The code is public." and a quiet "See the code on GitHub" button with the GitHub icon. Beside it (below on phone), on the `chip` panel, a list of small white cards in two columns (one on narrow screens), each a tiny uppercase `blue-text` label, a bold display-font tool line and a muted 13px description: THE APP / Next.js + TypeScript / Every screen and button; THE LOOK / Tailwind + Phosphor icons / Colors, type and icons; THE DATA / Postgres on Neon + Drizzle / Trips and money, to the centavo; SIGN-IN / Better Auth + Google / No passwords to keep; HOSTING / Vercel / The live site and private image storage; TESTING / Vitest / Automated checks on every change. A full-width `blue-soft` card last: MADE WITH / Claude Code / AI agents that planned, wrote and tested much of the code, with a person approving every step. No name anywhere on the page.
- **Last stop:** a centered `band`. Signed out: "Got a trip coming up?", "Start it here, then send the link to the group chat.", Continue with Google. Signed in: "Back to planning?", "Your trips are where you left them.", Go to My trips. Under it the "Privacy note" and "GitHub" links. The hero button and the last-stop button are never on screen together.
- **Motion:** each ticket, leg and the hero fade in and rise about 16px once (0.5s) as they come into view, done by a small script; the plane follows the scroll down the line (it sits about 45% down the screen). Reduce motion, no script or a script error: no fade, no rise, the plane stays at the top, everything visible. Content is visible by default; the script only adds motion on top.
- **Screenshots:** real screenshots of a made-up demo trip, "Siargao trip" (Bea owns it, with Migs, Jo and the guest Rica), Philippine peso, 390px wide, light mode, from the dev database only. Step 06 shows the Pay page "Jo pays Bea" with Bea's made-up GCash details and a fake QR. No real names, trips, amounts, numbers or photos. The phone frame is about 300px wide on a phone and 340px from 768px (360px and 420px tall), showing the top of the screen, on a plain `chip` background with no blur placeholder. Images are served at quality 90, lazy-loaded below the first screen, and have alt text that describes the screen.
- **Later:** a Bookings ticket once SQ-011 ships (in "During the trip", before Costs); "Stops 6" follows the count.
