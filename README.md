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
- [x] `/architect Work on SQ-001` (tech stack and first live page)
- [ ] Early friend test in January 2027
- [ ] Stage 1 ready for the group by end of February 2027

## Links
- Brief: `docs/BRIEF.md`

## Run it on your PC
Before you start:
- Node.js (LTS) must be installed.
- On Windows PowerShell, type `npm.cmd` and `npx.cmd` instead of `npm` and `npx` (PowerShell blocks the plain versions).
- After installing anything, open a NEW terminal (or reload PATH), or the new tool won't be found.
- The Vercel steps (`npx.cmd vercel ...`) need the Vercel account and project from the hosting setup first.
- Test data lives on a separate Neon branch called `dev` (free). Create it in Neon (Vercel, Storage, open the database in Neon, make a branch named `dev` from the main branch) before you run the app, so trips you create on your PC never reach the live site.

In a terminal, in this folder:
1. `npm.cmd install` - downloads the libraries the app uses (first time only).
2. `npx.cmd vercel env pull .env.local` - fetches the app's private settings (the database address and the sign-in settings) into a file git ignores. Needs a one-time `npx.cmd vercel login` and `npx.cmd vercel link` first.
3. Create `.env.development.local` in this folder with one line, `DATABASE_URL=` followed by the `dev` branch's connection address from Neon. `npm.cmd run dev` and `npx.cmd drizzle-kit` use this file first, so your PC works on test data. Never share or commit it.
4. `npx.cmd drizzle-kit migrate` - only when the database tables have changed (a new file appeared in `drizzle/`). It updates the dev database to match. To update the live database instead, you need the owner's OK: `npx.cmd vercel env pull .env.production.local --environment=production`, then run `drizzle-kit migrate` with `DB_ENV_FILE=.env.production.local` set, then delete that file.
5. `npm.cmd run dev` - starts the app.
6. Open http://localhost:3000 in your browser. Use `localhost`, not `127.0.0.1`: Google sign-in only works on `localhost`. Sign in again the first time, since the dev database has its own sign-ins. Stop it with Ctrl+C.

Other checks: `npm.cmd run lint` (style check), `npm.cmd test` (automatic tests), `npm.cmd run test:dev-db` (privacy tests on the `dev` database, using made-up people it deletes afterwards) and `npm.cmd run build` (the same build Vercel does).
On Vercel, previews read `PREVIEW_DATABASE_URL` when it is set, so phone tests use the `dev` database. Set it for Preview only and NEVER on Production, or the live site would read test data.
Chapters 1 to 3 of `LEARNING.md` explain how the pieces fit together.

## Live
Production address: https://sidequest-app-rho.vercel.app/ (updates on every merge into `main`).

## Log
- 2026-10-31 - Brief approved. Project created.
- 2026-10-31 - Owner's "Approved" also accepted the four-tab trip layout and per-trip balances on "My trips"; both are in the brief.
- 2026-10-31 - Brief amendment approved: Phase 1 split into 3 stages (Feb / Apr / after the trip); added payment details settle-up with privacy rules, common fund, offline viewing, Trip Wrapped, cost estimate; gap fixes (booking-to-cost button, review steps + trash, payment screenshots, flight time zones, actual PHP amounts, guests, account deletion, CSV export, no-pause hosting, change freeze, January friend test). Dropped "confirm received". Parked for Phase 2: n8n daily digest, connected trips.
- 2026-10-31 - `/pm` backlog approved: SQ-001..SQ-028 in 11 epics (local `backlog/`, git-excluded). Cut list: SQ-009, SQ-012, SQ-017, SQ-018. Phase 2 not backlogged. Next: SQ-001.
- 2026-10-31 - SQ-001: tech stack approved: Next.js on Vercel (free Hobby), Neon Postgres database (free, wakes itself after idle), Vercel Blob for images, Google sign-in via Auth.js. Rejected Supabase/Appwrite (pause after 7 idle days) and Firebase (image storage needs a card). GitHub repo private until SQ-028. Planned on branch `chore/project-setup`.
- 2026-10-31 - Owner created the GitHub repo `teejnavarro/sidequest` as public from the start, to track commits and time spent. Code goes public from the first push; secret/personal-data check before every push; merges keep individual commits.
- 2026-10-31 - GitHub repo renamed by the owner to `teejnavarro/sidequest-app`.
- 2026-11-01 - SQ-001 in progress: Node.js installed; Next.js app scaffolded with a placeholder home page and database check (local only, not yet pushed); LEARNING.md chapter 1 and run steps drafted.
- 2026-11-01 - SQ-001 built and pushed on `chore/project-setup`: preview on Vercel shows "Database connected" (fixed Vercel Framework Preset Other → Next.js); Neon wake-up measured at 684 ms. Next: /qa.
- 2026-11-01 - SQ-001 done: QA passed, PR #1 merged into `main` with a merge commit. Live at https://sidequest-app-rho.vercel.app/ showing "Database connected" with no login. Next: SQ-002 (Google sign-in).
- 2026-11-01 - SQ-002 in progress: Google sign-in built with Better Auth instead of Auth.js (Auth.js is now security-fix-only and its team recommends Better Auth). Added Vitest for automatic tests. Chapter 2 of LEARNING.md explains signing in.
- 2026-11-02 - SQ-002 done: QA passed, PR #2 merged into `main` with a merge commit. Google sign-in, My trips and Profile are live; the owner confirmed sign-in on the live site. Next: `/designer` round, then SQ-003.
- 2026-11-02 - Design direction chosen by the owner: Barkada (warm, friendly, orange accent, Bricolage Grotesque and Manrope). Mockup in `assets/mockups/barkada.html`, guide in `docs/design.md`.
- 2026-11-02 - Design colors changed by the owner from orange and brown to Open Road: ocean blue header, white cards and amber buttons, plus a route line on trip cards. Mockup and `docs/design.md` updated.
- 2026-11-02 - Design approved by the owner, with "You're owed" changed to green to match the depth of the red "You owe". Next: `/architect` for SQ-003, which also restyles the three existing screens.
- 2026-11-02 - SQ-003 in progress on `feature/trips-and-tabs`: trips with Schedule, Ideas, Bookings and Costs tabs, the new look on every screen, and a separate `dev` database for test data. Chapter 3 of `LEARNING.md` explains it.
- 2026-11-02 - SQ-003 done: QA passed, PR #3 merged into `main` with a merge commit. Trips, My trips, four tabs and the new look are live, and the owner confirmed them on the live site. Next: SQ-004 is next on the backlog; delete a trip, the invite link wording and SQ-029 await the owner's decision.
- 2026-11-03 - SQ-004 in progress on `feature/invite-link`: each trip has an invite link that members copy or share; opening it, signing in with Google and tapping Join trip adds the person. Owner decisions: one tap on Join trip (not automatic), the trip name and owner name are shown before sign-in (dates, photos and members stay hidden), and the invite page lists who is in. Chapter 4 of `LEARNING.md` explains it.
- 2026-11-03 - SQ-004 owner additions during the PC check: trips get an optional destination, and overlapping photo circles with "n people are going" appear on the join page, My trips cards and the trip header. This reverses the earlier rule that dates, photos and members stay hidden before sign-in: a visitor with the invite link now sees the trip name, destination, dates, the owner's name and everyone's photo or initials (other people's names are not in the page text). The owner chose this knowingly.
- 2026-11-03 - SQ-004 done: QA passed, PR #4 merged into `main` with a merge commit. Invite links, one-tap joining, an optional destination, photo circles and Who's in are live, and the owner confirmed the live invite up to the Join trip tap. Before sign-in the invite shows trip details and photos, by the owner's choice. Next: the owner picks the next story.
- 2026-11-03 - SQ-030 in progress on `feature/delete-trip`: added to the brief's scope at the owner's request. The trip owner can delete a trip for good from Edit trip, through a confirmation page that says how many people it affects. Owner decisions: owner only, one tap on a confirmation page (no typing the name), permanent delete with no trash. No database change. Chapter 5 of `LEARNING.md` explains it.
- 2026-11-04 - SQ-030 done: PR #5 merged with a merge commit and confirmed live by the owner. The trip owner can permanently delete a trip through a confirmation page (added beyond the brief at the owner's request). The trip header now shows a GMT offset and place, and the back link is readable in light mode. No database change.
- 2026-11-04 - UI refinement reviewed with Impeccable and Lavish before SQ-007: the owner approved eight changes (U1-U8), a clearer ocean header and an amber trip time tag. Guide updated in `docs/design.md`, and `PRODUCT.md` added. Not built yet. Next: `/architect`.
- 2026-11-04 - SQ-031 in progress on `feature/ui-refine`: the owner-approved UI refinement. Shorter trip header with a trip time tag (In 12 days, Day 2 of 4, Trip's over), a short ocean band with a back link on Edit, Invite, Delete, New trip and Profile, a clearer ocean blue, trip cards with "You + 2", a grouped New trip form with a live route line, an explained invite page, and a wording pass. No database change. Chapter 6 of `LEARNING.md` explains route groups and trip time.
- 2026-11-06 - SQ-031 done: PR #6 merged with a merge commit and confirmed live by the owner. The UI refinement (shorter trip header with trip time, clearer ocean blue, short task page headers, grouped trip form, join page explanation, wording and polish) is live. Checked on an iPhone and a Samsung. No database change.
- 2026-11-07 - SQ-007 in progress on `feature/ideas-list`: members add ideas with a name, type and rough duration, plus an optional Google Maps link, area, cost per person and notes. Ideas can be filtered by type, show who added them, and only the person who added an idea or the trip owner can edit or delete it. Names with accents (like "Chợ Bến Thành") are kept exactly. New `idea` table, so the live database needs a migration, with the owner's OK. Chapter 7 of `LEARNING.md` explains it.
