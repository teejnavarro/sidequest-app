# Project Brief — Sidequest

Approved by the owner on 2026-10-31, and the amended version (stages, payment details, gap
fixes) approved the same day. This brief is the contract; changes need the owner's approval.

```
PROJECT BRIEF — Sidequest (group trip planner)

Goal:            A web app where a travel group plans a trip together (schedule,
                 ideas with voting, flight and hotel details) and tracks shared
                 costs the way Splitwise does, built around how Filipino groups
                 actually travel (GCash/Maya/bank settle-up, common fund). It's
                 also a hands-on way for the owner to learn how a full-stack app
                 is built. Phase 2 adds n8n-powered extras, starting with a seat
                 sale watcher.

Final deliverable: A live web app on a free web address, working well in a phone
                 browser and on desktop. Its code is in a public GitHub repo
                 with a portfolio-quality README. Plus a plain-language
                 LEARNING.md that grows as each part is built.

Audience:        The owner and their travel groups (about 2–10 people per trip).
                 Recruiters and interviewers see the GitHub repo.

In scope (Phase 1) is built in three stages, timed to when each part gets used.

STAGE 1 — Planning (ready by end of February 2027)
  Trips & members
                 - Sign in with Google. Join a trip through a shared invite link.
                 - Each trip is a separate space with its own members, schedule,
                   ideas, bookings and costs. One person can be in many trips
                   with different groups.
                 - Guest members: name only, no account, can be included in cost
                   splits; a guest can later join and take over their spot
                 - "My trips" page listing every trip you belong to; each trip
                   card shows your own balance for that trip (e.g. "You're owed
                   ₱1,250", "All settled"), per trip, never added together
                 - Inside a trip, four tabs (a bottom tab bar on phones):
                   Schedule, Ideas, Bookings, Costs
                 - Trips: name, dates, destination time zone, main currency, members
                 - Trip owner: the creator owns the trip, can remove members,
                   and can transfer ownership to any member. An owner must
                   transfer ownership before leaving, so every trip always
                   has an owner.
                 - Members can leave a trip. Anyone who leaves or is removed
                   keeps their costs and balances in the trip (shown as "left
                   the trip") until settled, but no longer sees the trip.
                 - Only that trip's members can see it (and nothing else in it
                   shows up anywhere outside the trip)
  Account & privacy
                 - "Delete my account": removes the user's profile, payment
                   details and screenshots; their past costs stay in trips as
                   "former member" so balances don't break
                 - A short plain-language privacy note: what's stored, who sees
                   it, how to delete it
  Ideas
                 - Anyone adds an idea: name, type, rough duration (1–2 hrs /
                   half day / full day); optional link, area, cost per person, notes
                 - The form encourages pasting a Google Maps link, the most
                   reliable way to pin down the exact place
                 - Types: Food, Sightseeing, Adventure, Experience, Shopping,
                   Nightlife, Other. Shown as icons/tags; ideas can be filtered
                   by type.
                 - Names with accents and local characters (e.g. "Chợ Bến Thành")
                   are stored and shown exactly as typed
                 - Search ignores accents and capitals ("ben thanh" finds
                   "Chợ Bến Thành")
                 - While adding an idea, the app shows similar ideas already in
                   the trip, to avoid duplicates
                 - Everyone votes 👍/👎; vote counts are advice. Any member can
                   approve an idea and move it to the schedule.
                 - Approved-but-unscheduled ideas wait in their own list and can
                   be moved back to ideas
  Schedule
                 - Agenda-list layout: one card per day, scrolling through the trip
                 - Each item is placed at an exact time, a part of day
                   (Morning / Afternoon / Evening), or Full day
                 - Any member can place or move items; each item shows who
                   last changed it
                 - Items that don't need a vote (e.g. airport transfer) can be
                   added straight to the schedule
                 - Flights and hotel check-in/out appear on the right days
                   automatically
                 - Times shown in the destination's local time, except flights:
                   each flight time is shown in its own airport's local time
  Bookings
                 - Flight and hotel details in one place per trip
                 - Optional price per person on each booking (feeds the estimate)
                 - "Log this as a paid cost" button, so a booking's actual payment
                   goes into Costs once, without retyping
  Trip cost estimate
                 - "Estimated trip cost: ~₱X per person", added up from scheduled
                   items' cost per person plus flight and hotel prices; updates
                   as the plan changes
                 - Clearly labelled as the plan; Costs shows what was actually paid
  Costs
                 - Shared costs like Splitwise: anyone logs a cost, who paid,
                   split equally among chosen people; running balances
                   (who owes whom); a settle-up summary with the fewest payments
                 - Optional category on each cost: Food, Transport, Lodging,
                   Activities, Shopping, Other
                 - Balances and settle-up are per trip and never mixed between trips
                 - Costs in other currencies: enter a rate (e.g. VND to PHP)
                   or the actual PHP amount charged (e.g. from a card payment);
                   everything shown in the trip's main currency
                 - Every cost shows who added it and who last edited it
                 - Review before saving: adding shows a summary ("Ana paid
                   ₱3,000, split 4 ways = ₱750 each. Save?"); editing shows
                   before → after; deleting asks "Are you sure?"
                 - Deleted costs go to a trash and can be restored
                 - Export the trip's costs to a spreadsheet file (CSV)
  Payment details & settle-up
                 - Each user saves receiving details on their profile: GCash/Maya
                   number, bank name + account name + account number, QR images
                 - Settle-up: tap "Ben pays Ana ₱1,200" to see Ana's QR and
                   account details (with a copy button), then record the payment
                 - Recording a payment shows a review step before saving, and
                   can include an optional screenshot of the payment receipt,
                   visible only to the payer and the receiver
                 - Safety rules: receiving details only (no fields for card
                   numbers, CVV, PINs, OTPs or passwords); visible only to people
                   currently in a trip with you; access ends when someone leaves
                   or is removed; only you can add, edit or delete your own

STAGE 2 — On the trip (ready by end of April 2027)
                 - Common fund ("ambagan"): members record what they chip in to a
                   pot held by one member (the treasurer); spending can be paid
                   from the fund; everyone sees the fund balance; leftovers are
                   split back at the end. All of it feeds the same per-trip
                   balances and settle-up.
                 - Works offline: the trip's schedule, bookings, addresses and
                   payment details open on your phone with no signal (viewing
                   only; changes need a connection)

STAGE 3 — After the trip
                 - Trip Wrapped: a shareable recap when the trip ends (total
                   spent, per person, money by category, most-upvoted idea, who
                   paid the most), shown in the app and saveable as an image

In scope (Phase 2 / version 2, starts only after the owner gives a separate go-ahead):
                 - /research on fare data sources (free vs paid, which airlines,
                   domestic and international)
                 - Seat sale watcher: routes and target prices, n8n checks on a
                   schedule, alerts, price history in the app
                 - /research on place search with autocomplete (Google vs free
                   OpenStreetMap-based options, cost, card requirement),
                   done before the AI draft so the two work together
                 - AI itinerary draft: a "suggest a plan" button that sends
                   approved ideas through n8n to an AI and returns a draft
                   schedule the group then edits
                 - n8n daily digest: "3 new ideas, 1 new cost" sent to members
                 - Connected / multi-destination trips (e.g. Vietnam + Cambodia,
                   with more than one currency and time zone)

Out of scope:    - Native iPhone/Android apps or app store publishing
                 - Moving real money or connecting to GCash/Maya/banks (the app
                   records debts and shows details; people pay in their own apps)
                 - Storing card numbers, CVVs, PINs, OTPs or passwords, ever
                 - A "confirm received" step for payments (trust between friends,
                   plus the review step and optional screenshot)
                 - In-app group chat (the group keeps using Messenger/Viber/etc.)
                 - Automatic rule-based scheduling (replaced by the Phase 2 AI draft)
                 - Editing while offline (viewing only)
                 - A combined balance across all trips (possible later)
                 - Custom split amounts, live exchange rates, maps, travel times,
                   opening-hours checks, overlap warnings, packing lists, receipt
                   photos for costs, comments on items, pasalubong list
                   (possible later)
                 - Teams/Outlook-style time-grid calendar view (possible later,
                   for laptop users)
                 - Importing the current Google Doc (the plan is moved over by hand)
                 - Copying Splitwise's look or branding (it works like
                   Splitwise but has its own design)

Expectations:    - Simple, clean, phone-first; easy for non-tech friends to use
                 - Money math exact to the centavo; settle-up always adds up to zero
                 - Payment details and payment screenshots treated as private
                   data: checked specifically in QA that only the right people
                   can ever see them
                 - Agents build the code (option A). Owner approves each stage,
                   tests it, and gets a plain-language walkthrough (/guide).
                   Every stage ends with a short "your action items" list.
                 - LEARNING.md explains each new concept and full-stack habit
                   in plain words as it comes up

Constraints:     - Budget ₱0: free hosting and database tiers only (any cost
                   needs approval first)
                 - Hosting and database must not pause or sleep from inactivity
                   in a way that could make the app unavailable mid-trip
                 - Stage 1 by end of February 2027, Stage 2 by end of April 2027,
                   Stage 3 after the May 2027 Ho Chi Minh City trip
                 - Change freeze: no new features in the 2 weeks before the trip
                   (bug fixes only, with owner OK)
                 - Public repo: no real names, trips, costs, payment details or
                   secret keys in the code
                 - Owner is not a developer; all choices explained plainly

Success criteria:
                 - The group plans the Ho Chi Minh City trip in the app instead of
                   the Google Doc: ideas added and voted on, a full schedule
                   built (timed, part-of-day and full-day items), flights and
                   hotel entered and showing on the schedule
                 - Vietnamese place names with accents display correctly, and
                   searching without accents finds them
                 - Flight times show correctly in each airport's local time
                 - The trip cost estimate matches a manual check of the plan
                 - Trip costs logged in PHP and VND by different members; the
                   settle-up result is checked and everyone agrees it's correct
                 - A guest member is included in splits and later takes over
                   their spot by joining
                 - A deleted cost is restored from the trash, and every cost shows
                   who added and edited it
                 - Members settle up using each other's saved QR/account details
                   without asking for them in the group chat
                 - A non-member cannot see anyone's payment details, and a
                   payment screenshot is visible only to its payer and receiver
                   (tested)
                 - Deleting an account removes its payment details and leaves
                   trip balances intact
                 - The CSV export opens in Excel/Google Sheets with totals that
                   match the app
                 - A second test trip with a different group stays fully
                   separate: neither group can see the other's trip, and their
                   balances don't mix
                 - In a test trip, ownership is transferred and a member with an
                   unpaid balance leaves; balances still add up and settle-up
                   still includes them
                 - Stage 2: the common fund's balance and leftovers match a manual
                   check; the trip opens on a phone in airplane mode
                 - Stage 3: the HCMC Trip Wrapped totals match the cost log
                 - Works smoothly on members' phones; non-members can't see the trip
                 - Public GitHub repo with a clear README and no personal data
                 - Owner can explain in their own words how the app is put
                   together (front end, back end, database, logins, hosting)

Plan:            1. /pm: turn this brief into a prioritized backlog by stage,
                    with a "cut list" of Stage 1 items that can slip to March
                    without hurting the core
                 2. Foundation: tech choices (explained plainly), hosting,
                    Google sign-in, trips, "My trips", invite links, ownership,
                    guests, account deletion
                 3. Itinerary: ideas with types, voting, search and duplicate
                    hints; schedule; flight and hotel details; cost estimate
                 4. Shared costs: splits, categories, review steps, trash,
                    balances, settle-up, other currencies, members who left,
                    payment details, screenshots, CSV export
                 5. Early friend test (January 2027): one or two friends try it;
                    fix what they find
                 6. Group trial: the whole group plans HCMC in it (Stage 1 done,
                    end Feb)
                 7. Stage 2: common fund + offline (end Apr), then change freeze
                 8. Stage 3: Trip Wrapped (after the trip)
                 9. /review-brief, then wrap up Phase 1
                10. Phase 2 (separate go-ahead): research, seat sale watcher,
                    AI itinerary draft, daily digest, connected trips

Open questions:  None.

Assumptions:     - Splitting ₱1,000 among 3 leaves one extra centavo; one person
                   absorbs it, as Splitwise does
                 - Apart from owner powers (remove members, transfer ownership),
                   every member can edit everything in the trip
                 - "Similar ideas" matching catches spelling and accent
                   differences, not completely different descriptions of the
                   same place
                 - The trip cost estimate is a rough guide: it only counts items
                   that have a price entered
                 - One treasurer per trip's common fund; any member can be it
                 - One destination (one main currency and time zone) per trip in
                   Phase 1; connected trips are a Phase 2 idea
                 - Payment screenshots are shrunk on upload to stay within free
                   storage limits
                 - The Architect picks the tech stack; the main choices get
                   explained to you before building starts

Track:           Code (app + later n8n workflows, all through /pm → /architect → /builder → /qa → /integrator)
```
