# Sidequest

**Status:** Active
**Started:** 2026-10-31

## Goal
A web app where a travel group plans a trip together (schedule, ideas with voting, flight
and hotel details) and tracks shared costs the way Splitwise does. It's also a hands-on way
for the owner to learn how a full-stack app is built. First real use: the Ho Chi Minh City
trip in May 2027.

## Scope
- Stage 1, planning (end Feb 2027): Google sign-in, invite links, guests; separate trips
  with owners; "My trips" with per-trip balances; Schedule, Ideas, Bookings and Costs tabs;
  trip cost estimate; Splitwise-style splits with review steps, trash and CSV export;
  GCash/Maya/bank settle-up with optional payment screenshots; account deletion.
- Stage 2, on the trip (end Apr 2027): common fund ("ambagan"), offline viewing.
- Stage 3, after the trip: Trip Wrapped recap.
- Phase 2 (separate go-ahead): seat sale watcher, place search, AI itinerary draft, daily
  digest, connected trips (n8n-powered).
- Out: native apps, moving real money, card details, group chat, combined balance across trips.
- Full detail: `docs/BRIEF.md`.

## Next steps
- [x] Run `/pm` to turn the brief into a backlog by stage, with a cut list
- [ ] `/architect Work on SQ-001` (tech stack and first live page)
- [ ] Early friend test in January 2027
- [ ] Stage 1 ready for the group by end of February 2027

## Links
- Brief: `docs/BRIEF.md`

## Log
- 2026-10-31 - Brief approved. Project created.
- 2026-10-31 - Owner's "Approved" also accepted the four-tab trip layout and per-trip balances on "My trips"; both are in the brief.
- 2026-10-31 - Brief amendment approved: Phase 1 split into 3 stages (Feb / Apr / after the trip); added payment details settle-up with privacy rules, common fund, offline viewing, Trip Wrapped, cost estimate; gap fixes (booking-to-cost button, review steps + trash, payment screenshots, flight time zones, actual PHP amounts, guests, account deletion, CSV export, no-pause hosting, change freeze, January friend test). Dropped "confirm received". Parked for Phase 2: n8n daily digest, connected trips.
- 2026-10-31 - `/pm` backlog approved: SQ-001..SQ-028 in 11 epics (local `backlog/`, git-excluded). Cut list: SQ-009, SQ-012, SQ-017, SQ-018. Phase 2 not backlogged. Next: SQ-001.
- 2026-10-31 - SQ-001: tech stack approved: Next.js on Vercel (free Hobby), Neon Postgres database (free, wakes itself after idle), Vercel Blob for images, Google sign-in via Auth.js. Rejected Supabase/Appwrite (pause after 7 idle days) and Firebase (image storage needs a card). GitHub repo private until SQ-028. Planned on branch `chore/project-setup`.
- 2026-10-31 - Owner created the GitHub repo `teejnavarro/sidequest` as public from the start, to track commits and time spent. Code goes public from the first push; secret/personal-data check before every push; merges keep individual commits.
- 2026-10-31 - GitHub repo renamed by the owner to `teejnavarro/sidequest-app`.
