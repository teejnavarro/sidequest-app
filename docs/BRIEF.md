# Project Brief — Sidequest

Approved by the owner on 2026-10-31. This brief is the contract; changes need the owner's approval.

```
PROJECT BRIEF — Sidequest (group trip planner)

Goal:            A web app where a travel group plans a trip together (schedule,
                 ideas with voting, flight and hotel details) and tracks shared
                 costs the way Splitwise does. It's also a hands-on way for the
                 owner to learn how a full-stack app is built.
                 Phase 2 adds n8n-powered extras, starting with a seat sale watcher.

Final deliverable: A live web app on a free web address, working well in a phone
                 browser and on desktop. Its code is in a public GitHub repo
                 with a portfolio-quality README. Plus a plain-language
                 LEARNING.md that grows as each part is built.

Audience:        The owner and their travel groups (about 2–10 people per trip).
                 Recruiters and interviewers see the GitHub repo.

In scope (Phase 1, version 1):
  Trips & members
                 - Sign in with Google. Join a trip through a shared invite link.
                 - Each trip is a separate space with its own members, schedule,
                   ideas, bookings and costs. One person can be in many trips
                   with different groups.
                 - "My trips" page listing every trip you belong to; each trip
                   card shows your own balance for that trip (e.g. "You're owed
                   ₱1,250", "All settled") — per trip, never added together
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
                 - All times shown in the destination's local time
  Bookings
                 - Flight and hotel details in one place per trip
  Costs
                 - Shared costs like Splitwise: anyone logs a cost, who paid,
                   split equally among chosen people; running balances
                   (who owes whom); a settle-up summary with the fewest payments
                 - Balances and settle-up are per trip and never mixed between trips
                 - Costs in other currencies, using a rate the user types in
                   (e.g. VND to PHP); everything shown in the trip's main currency

In scope (Phase 2, starts only after the owner gives a separate go-ahead):
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

Out of scope:    - Native iPhone/Android apps or app store publishing
                 - Moving real money (the app records debts; people pay each
                   other through GCash, cash, etc.)
                 - In-app group chat (the group keeps using Messenger/Viber/etc.)
                 - Automatic rule-based scheduling (replaced by the Phase 2 AI draft)
                 - A combined balance across all trips (possible later)
                 - Custom split amounts, live exchange rates, maps, travel times,
                   opening-hours checks, overlap warnings, packing lists, receipt
                   photos, comments on items (possible later)
                 - Teams/Outlook-style time-grid calendar view (possible later,
                   for laptop users)
                 - Importing the current Google Doc (the plan is moved over by hand)
                 - Copying Splitwise's look or branding (it works like
                   Splitwise but has its own design)

Expectations:    - Simple, clean, phone-first; easy for non-tech friends to use
                 - Money math exact to the centavo; settle-up always adds up to zero
                 - Agents build the code (option A). Owner approves each stage,
                   tests it, and gets a plain-language walkthrough (/guide).
                   Every stage ends with a short "your action items" list.
                 - LEARNING.md explains each new concept and full-stack habit
                   in plain words as it comes up

Constraints:     - Budget ₱0: free hosting and database tiers only (any cost
                   needs approval first)
                 - Version 1 ready for the group by end of February 2027, giving
                   2+ months of planning before the May 2027 Ho Chi Minh City trip
                 - Public repo: no real names, trips, costs or secret keys in the code
                 - Owner is not a developer; all choices explained plainly

Success criteria:
                 - The group plans the Ho Chi Minh City trip in the app instead of
                   the Google Doc: ideas added and voted on, a full schedule
                   built (timed, part-of-day and full-day items), flights and
                   hotel entered and showing on the schedule
                 - Vietnamese place names with accents display correctly, and
                   searching without accents finds them
                 - Trip costs logged in PHP and VND by different members; the
                   settle-up result is checked and everyone agrees it's correct
                 - A second test trip with a different group stays fully
                   separate: neither group can see the other's trip, and their
                   balances don't mix
                 - In a test trip, ownership is transferred and a member with an
                   unpaid balance leaves; balances still add up and settle-up
                   still includes them
                 - Works smoothly on members' phones; non-members can't see the trip
                 - Public GitHub repo with a clear README and no personal data
                 - Owner can explain in their own words how the app is put
                   together (front end, back end, database, logins, hosting)

Plan:            1. /pm: turn this brief into a prioritized backlog
                 2. Foundation: tech choices (explained plainly), hosting,
                    Google sign-in, trips, "My trips", invite links, ownership
                 3. Itinerary: ideas with types, voting, search and duplicate
                    hints; schedule; flight and hotel details
                 4. Shared costs: splits, balances, settle-up, other currencies,
                    members who left
                 5. Group trial: friends use it to plan HCMC; fix what they find
                 6. /review-brief, then wrap up version 1
                 7. Phase 2 (separate go-ahead): /research fare data and place
                    search, then the seat sale watcher and AI itinerary draft

Open questions:  None.

Assumptions:     - Splitting ₱1,000 among 3 leaves one extra centavo; one person
                   absorbs it, as Splitwise does
                 - Apart from owner powers (remove members, transfer ownership),
                   every member can edit everything in the trip
                 - "Similar ideas" matching catches spelling and accent
                   differences, not completely different descriptions of the
                   same place
                 - The Architect picks the tech stack; the main choices get
                   explained to you before building starts

Track:           Code (app + later n8n workflows, all through /pm → /architect → /builder → /qa → /integrator)
```
