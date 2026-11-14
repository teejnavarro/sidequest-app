# Learning Sidequest

A plain-words guide to how this app is built. Each chapter explains the new ideas
that came with one step of the project. No programming knowledge needed.

---

## Chapter 1: How the pieces fit together

### The restaurant analogy

A website or app that people can sign in to is made of six parts. The easiest way to
remember them is a restaurant.

| Part | In the restaurant | What it does in an app | Who plays it in Sidequest |
|---|---|---|---|
| **Front end** | The dining room: menu, tables, plates | The screens you see and tap on your phone | Next.js (the "page" part) |
| **Back end** | The kitchen | The code that runs on a computer far away: checks who you are, does the maths, prepares what the screen needs | Next.js (the "server" part) |
| **Database** | The pantry and the order book | Where facts are kept for good: trips, costs, who owes whom | Neon (a Postgres database) |
| **File storage** | The cold room for big items | Where pictures and files are kept, such as payment QR codes | Vercel Blob (added later) |
| **Sign-in** | The host at the door with the guest list | Decides who is allowed in and who they are | Better Auth with Google |
| **Hosting** | The building and its address | The always-on computers that make the app reachable from any phone | Vercel |

Some terms you will meet again:

- **Server**: a computer that is always on and answers requests from phones and laptops.
  "The cloud" just means someone else's servers.
- **Framework**: a ready-made toolbox for building apps so we don't start from zero.
  Next.js is our framework. It handles the dining room and the kitchen in one project.
- **Postgres**: a very common kind of database. It stores information in tables
  (rows and columns, like a spreadsheet) and you ask it questions in a language called
  SQL. If you already know SQL from data work, you can use the same skill on this app's data.

### Why these choices

- Everything we use is on a **free plan**, and none of it switches itself off after a
  few days of nobody using it. That matters because the group will lean on the app
  during a trip.
- We picked well-known tools on purpose. See "The boring technology habit" below.

### How a change travels from your PC to the live site

Every time we change the app, the change takes the same trip:

1. **Edit**: a file on your PC is changed.
2. **Commit**: we save a labelled snapshot of the change in **git**, the tool that
   remembers every version of every file. A **commit** is one snapshot with a short
   message saying what changed and why.
3. **Push**: we send the new commits to **GitHub**, a website that keeps a copy of
   the project online. Pushing is like uploading your saved snapshots.
4. **Vercel builds**: Vercel notices the new commits on GitHub, takes the code,
   **builds** it (turns it into the form that servers can run, and checks for
   mistakes) and starts it.
5. **Live**: the new version is now available at its web address.

Two kinds of live versions exist:

- **Production** is the real one. It is rebuilt whenever the `main` branch changes.
  A **branch** is a separate line of work in git, so unfinished changes don't disturb
  the finished version. `main` is the finished version.
- **Preview** is a private-ish test copy that Vercel makes for every other branch,
  each with its own web address. We look at the preview, and only when it is good do
  we bring the branch into `main`, which updates production.

### Secrets and environment variables

Some information must never be written into the code, because the code is public on
GitHub and anyone could read it. The main example is the database address, which
includes a password. If it leaked, strangers could read or wipe the data.

- An **environment variable** is a named setting that lives outside the code. The
  code asks for it by name (here, `DATABASE_URL`) and the computer it runs on supplies
  the value.
- A **secret** is an environment variable you must keep private, such as passwords and
  keys.
- On Vercel, the values are stored in the project's settings. On your PC, they live in
  a file called `.env.local`, which git is told to ignore (that is what `.gitignore`
  does), so it can never be uploaded by accident.
- `.env.example` is the opposite: a harmless template that lists the names with no
  values, so anyone can see which settings the app needs.

### Neon naps and wakes up

To stay on a free plan, Neon puts the database to sleep after about 5 minutes with no
visitors. It wakes by itself when the next request arrives, so the app is never
"down". The only effect is that the **first** page load after a quiet spell is slower,
usually well under 2 seconds. Later loads are fast again.

We deliberately do **not** add tricks to keep it awake. A short wait is a fair price
for staying free, and fewer tricks means fewer things to break.

Measured wake-up time on this project: **684 ms**, about two-thirds of a second,
on a phone after a 10-minute nap.

The home page shows a small status line ("Database connected ✓ (N ms)") so you can see
this yourself. The number is how long the database took to answer.

### Windows tip

In Windows PowerShell, type `npm.cmd` and `npx.cmd` instead of `npm` and `npx`. PowerShell blocks the plain scripts by default; the `.cmd` versions do the same job. After installing a tool, open a new terminal so it can be found.

### The boring technology habit

When there is a choice, prefer tools that are popular, well documented and have been
around for years. They have the most tutorials and answered questions, the fewest
surprises, and the best odds of still working in five years. Spend your curiosity on
your app, not on a risky tool. Every choice in this project follows that habit.

### Where we are

The first working chain is in place: **your PC → GitHub → Vercel → Neon**. The page
is deliberately plain. It exists to prove that every link in the chain works.

Two kinds of web address exist:

- **Preview addresses** are made per branch, for example for `chore/project-setup`.
  They are private: Vercel asks for a login before showing them. That is Vercel's
  default protection for previews, and it is a good thing.
- **The production address** is the public one, built from `main`. It is confirmed
  after the first merge into `main`, in Vercel under Settings, then Domains. Don't
  guess it: a similar-looking address can belong to someone else.

### What went wrong and what we learned

The first preview build failed with "No Output Directory named public". Vercel looks
at the project **once, when you import it**, and guesses what kind of project it is
(the "Framework Preset"). We imported before the app existed on `main`, so Vercel
guessed "Other" and treated the project as a plain folder of files. The fix was to
change the Framework Preset to **Next.js** in the project settings and redeploy.

The habit: when something works on your PC but not on the server, compare the two
environments first (versions, settings, variables, what was there at the time),
before you suspect the code. Here the code was fine; the server's guess was wrong.

---

## Chapter 2: Signing in

Chapter 1 gave the restaurant a host at the door. This chapter explains how that host
works, and what we added to the pantry (the database) so the host can remember people.

### "Sign in with Google" (OAuth)

When you tap "Continue with Google", Sidequest does not ask for a password. It sends
you to Google, Google checks who you are (it already knows you), and then Google tells
Sidequest: "Yes, this is Maya, here is her name and photo." The restaurant host checks
an ID that Google issued, and never sees the password behind it. This arrangement is
called **OAuth**. The big benefit is that Sidequest **never sees or stores your
password**, so there is no password to leak.

Google only sends people back to addresses we registered in advance (our "redirect
addresses"). That is why sign-in works on localhost, on the live site, and on one fixed
test address, but not on every random preview link.

### The session cookie (a wristband)

After Google vouches for you, the host gives you a wristband: a small piece of data
called a **session cookie**, stored in your browser. Every time you open a page, your
browser shows the wristband, so you don't have to sign in again on each tap. Signing
out tears the wristband off.

### Why the server checks every time

Anyone can print a fake wristband sticker. So the first guard at the door (the
`proxy` file) only checks "is there a wristband at all?" for a quick yes or no. The
**real check** happens in the kitchen: each protected page asks the server "is this
wristband on the list of real, current sessions?" before showing anything. The rule is
**never trust the browser**: whatever your phone sends could have been faked, so the
server decides.

### Database tables and migrations

To remember who is signed in, the pantry needs new shelves (tables): `user`,
`session`, `account` and `verification`. A **migration** is a renovation plan for the
pantry: a small file that says "add these shelves". We keep these plans in git (in the
`drizzle/` folder) so every copy of the app can be built the same way, and so we can
see how the pantry changed over time. Running a migration applies the plan to the
real database.

### Drizzle (an ORM)

Instead of writing SQL by hand for everything, we use **Drizzle**, an **ORM**
(object-relational mapper). It lets the code describe the tables in TypeScript and
ask for data in a safer, typed way, and it also writes our migration plans. You can
still read and run plain SQL on the same database.

### Automated tests (Vitest)

An **automated test** is a small program that checks another program. For example, our
tests check that a display name is trimmed, that "Nguyễn" is accepted, and that a
visitor without a wristband is sent home. **Vitest** runs them all with `npm.cmd test`.
If we later change something and break a rule, a test fails right away instead of a
friend finding the bug on a trip.

### Why preview links can't sign in

Google only returns people to the addresses we registered. Vercel makes a new random
preview address for every commit, so most of them are not registered and Google
refuses them. We register localhost, the live site, and one fixed address for this
branch. Everything else shows the pages, but not sign-in.

### What we learned: check that a tool is still looked after

The earlier plan used **Auth.js**. While planning this step we found that its team
had joined the Better Auth project, was only shipping security fixes, and still had
its newest version in "beta". It recommends **Better Auth** for new projects, so we
switched before writing any code. The habit: before adopting a tool, look at when it
last had a real release, who maintains it, and whether its own authors point
elsewhere. Ten minutes of checking saves a rewrite later.

---

## Chapter 3: Trips and tabs

### Tables that point to each other

Chapter 2 gave the pantry shelves for people. This step adds two more: `trip` (one row
per trip: its name, dates, time zone, currency and who owns it) and `trip_member` (one
row for each person who belongs to a trip). The second table is a guest list. It does not
copy anything about the trip or the person. It only holds two labels: the trip's id and
the person's id. This is called a **foreign key**: a label in one table that points to a
row in another. To list "my trips", the app looks up my rows on the guest list, then
follows each label to the trip. It also means a trip can have many people, and a person
can be on many trips, without storing anything twice.

### One privacy checkpoint

Trips are private, so every question about trips ("show me this trip", "change this
trip") has to ask first: is this person on the guest list? If twenty different pages each
remembered to ask, one of them would eventually forget. So all trip questions go through
one file, `src/lib/trips.ts`, like a single front desk. The check is part of the database
question itself ("give me this trip, but only if this person is a member"), so there is no
gap between checking and doing. A stranger gets the same "we couldn't find that trip"
whether the trip does not exist or just isn't theirs, so they can't learn which trips
exist.

### All-or-nothing saves

Creating a trip means writing two rows: the trip, and the owner's place on the guest
list. If the computer failed between the two, we would have a trip nobody belongs to.
Databases solve this with an all-or-nothing save: either both rows are written or
neither. Our database connection can't hold a save open while the app thinks, so we send
both writes together in one **batch**, which the database treats as one unit.

### Why test data and live data are separate

Until now the app on your PC and the live site shared one database. That was fine while
it held only sign-in records. Now it holds real trips, so playing around on your PC could
leave junk (or break something) on the live site. Neon, our database host, lets us make a
**branch**: a full copy of the database that lives on its own. We made one called `dev`.
On your PC the app uses `dev`, so anything you try there never reaches the live site.
Changing the live database is a deliberate step that needs your OK, and new tables are
added to it with a migration only after they work on `dev`.

### Design tokens

A **design token** is a name for a design choice, such as `card` for "the white of a
card" or `owe` for "the red used when you owe money". We keep every color in one place
(`src/app/globals.css`), with a light and a dark value for each. Screens use the name,
never the color. To change the look of the whole app, or to make dark mode work, we
change one line and every screen follows.

### Dates that don't move

A trip date such as 12 March is a day on the calendar, not a moment in time. If a computer
treats it as a moment, then in another part of the world 12 March can turn into 11
March. So we store dates as plain text days and format them without looking at the
viewer's own time zone. The test even changes the computer's time zone to prove it.

---

## Chapter 4: Invite links

### An invite code is a key

Every trip now has a long random code, for example a string of letters and numbers
that nobody could guess. The invite link is just that code written into a web address.
Whoever holds the link holds the key: they can see the trip's name and who owns it, and
after signing in they can join. That is why the invite page tells you to share the link
only with your group. The code is made by the database itself, from a strong source of
randomness, so it is not something a person (or our own code) invents. Only members of
a trip can see its code. The trip list and trip pages never include it.

### Opening a page must never change anything

Chat apps, browsers and phones often open a link in the background to show a little
preview, or to load it faster before you tap. If simply opening the invite page added
you to the trip, a preview could add people who never asked to join. So the invite page
only shows information. Joining happens only when you tap **Join trip**, which sends a
separate request to the server. The same habit applies everywhere: looking is safe,
and changing something needs a deliberate tap.

### Coming back to the right page after signing in

When a friend opens the link without being signed in, they must sign in with Google
first. Google sends them back afterwards, and we tell Google where: the same invite
page. We build that return address ourselves from the code, after checking the code
looks like a real one. We never take a return address from the web page, because a
tricky link could try to send people to a fake site after signing in.

### How a default fills in old rows

Trips already existed before this step, and they had no code. We added the code column
with a **default**: "when nothing is given, let the database make a random code".
When the database applied that to the table, it filled in a different random code for
each existing trip, all at once. It also means the live site keeps working while the
new column is being added, because the old code never needs to supply one.

### A privacy trade-off, chosen on purpose

At first the invite page showed a stranger only the trip name and who owns it. Then we
decided friends would feel more at ease seeing where, when and who is going, so a visitor
with the link now also sees the destination, the dates and the photo circles of everyone
already in. That is a trade: more welcoming, less private. What we did to keep it
reasonable: the link is a long random secret that only members can see; other people's
names stay out of the page (their photos and initials show, but nothing a screen reader or
a text search would pick up as a name); and the page tells you to share the link only with
your group. Privacy is rarely all or nothing. It helps to write down what is shown, to
whom, and why, so the choice is deliberate and can be changed later.

---

## Chapter 5: Deleting a trip

### Deleting for good

Some deletes can be undone (a "trash" that keeps things for 30 days). This one cannot: once
the owner taps Delete trip, the trip is gone from the database. We chose that on purpose
because it is simpler and the data is truly gone, so a deleted trip can't come back by
accident. Because it can't be undone, the app first shows a separate confirmation page that
says who is affected, and the safe choice, Keep trip, is the big main button.

### A cascade removes linked rows

Chapter 3 explained that a trip and its guest list are two tables pointing at each other.
When we created the guest list table we told the database: "if a trip is removed, remove
its guest list rows too". That rule is called a **cascade**. So the app deletes one row,
the trip, and the database cleans up the rest by itself. The invite link needs no cleanup,
because its secret code is stored on the trip row and disappears with it. That is why the
old link now says "This invite link isn't working".

### Check the owner inside the delete

Hiding the Delete trip link from other members is just good manners; it is not security,
because anyone can type an address or send a forged request. The real check is inside the
delete itself: "remove this trip, but only if this person is its owner". If someone who is
not the owner tries, the database matches nothing and nothing is deleted. The same happens
when a delete is repeated, so pressing the button twice, or a second try from a forged
request, does no harm and tells the person nothing about which trips exist.

---

## Chapter 6: Tidying the screens

### Route groups: two kinds of trip page

A trip has two kinds of pages. The four tabs (Schedule, Ideas, Bookings, Costs) share one big
header and a tab bar. The pages where you do one job (Edit, Invite, Delete) should be quieter,
with a short header and no tab bar. In Next.js you can put the four tab pages in a folder whose
name is wrapped in brackets, like `(tabs)`. The brackets mean the folder is only for organising:
it does not appear in the web address, so every link keeps working. The shared header and tab bar
are attached to that folder, so only the tab pages get them.

### Why a trip's "today" uses the trip's own time zone

The little tag on a trip ("In 12 days", "Day 2 of 4", "Trip's over") counts days. But what day is
it right now? For someone in Manila it might already be tomorrow while it is still today in Los
Angeles. A trip to Manila starts when it is that day in Manila, so we work out "today" in the
trip's own time zone, then count whole days from the dates we stored. Days are plain calendar
dates, never moments in time, so nobody's phone can move a date by a day.

---

## Chapter 7: The Ideas list

### A new table needs a migration

The Ideas list keeps its data in a new table, `idea`, so the database has to be told about it.
A **migration** is a small file that says "add this shelf". We write it once, run it on the test
copy of the database first, and only run it on the live one when the owner says so. Because
this table is brand new and the live site doesn't use it yet, adding it early does no harm.

### Deleting a trip deletes its ideas

Every idea points at its trip, and we told the database: "if the trip goes, remove its ideas
too". That rule is called a **cascade**, the same one that removes a trip's guest list. We never
have to remember to clean up ideas by hand, and nothing is left behind pointing at a trip that
no longer exists.

### A filter can live in the web address

When you tap Food on the Ideas list, the address becomes `.../ideas?type=food`. The filter is
just a word in the address. That has a nice side effect: the Back button and refreshing the page
keep the filter, and you could send that exact filtered view to a friend. The page reads the word,
and if it is not one of the real types (or no idea uses it), it quietly shows everything.

### Who may change what

Anyone in the trip can add an idea and see them all. Only the person who added an idea, or the
trip owner, can edit or delete it. As with deleting a trip, hiding the Edit button is just good
manners. The real rule is inside the database request: "change this idea, but only if this
person added it or owns the trip". If someone else tries, nothing changes.

---

## Chapter 8: Voting and approving ideas

### A tap shows at once, then the saving catches up

When you tap a thumb, the number changes on your screen straight away, before the phone has
heard back from the server. That is called an **optimistic update**: we guess the save will
work, show the result, and check afterwards. The server sends back the real counts, and we use
those. If the save fails, the card goes back to how it was and a short message says so. Without
this trick every tap would feel like waiting for a slow page.

### Why the cards don't jump

If every vote re-sorted the list, the card you just voted on could slide away from under your
thumb. So the list keeps its order while you vote, and sorts itself (most liked first) the next
time you open the tab.

### One vote each, and the database enforces it

A vote is a row with the idea and the person. The pair is the row's key, so the database itself
refuses a second vote from the same person on the same idea. Tapping the same thumb again
removes your row; tapping the other thumb changes its value. Two quick taps can't count twice.

### Votes are advice, approval is a decision

Anyone in the trip can approve an idea, and anyone can move it back. Approval is just two extra
fields on the idea: when, and by whom. Votes never approve anything by themselves.

### This one needs a live database update too

Like the Ideas list, this adds a table (`idea_vote`) and two columns, so the live database
needs a migration. The new columns can be empty and the live site doesn't use them yet, so it
can run before the new code goes out, with the owner's OK.

## Chapter 9: The day-by-day schedule

### One table for two kinds of item

The Schedule holds two kinds of thing: an approved idea you put on a day, and something new that
needs no vote, like "Airport transfer". Instead of two tables we use one, `schedule_item`. An
item either points at an idea (and takes its name from the idea) or has a name of its own. Two
rules in the database itself keep this honest: an item can't have both an idea and its own name,
and can't have neither. A third rule says an item has a clock time exactly when its "when" is
Exact time. The idea column is also unique, so one idea can't be on the schedule twice, even if
two people tap Schedule it at the same moment.

### Times are the clock on the wall, in the trip's own place

"19:30" on a Ho Chi Minh City trip means 19:30 in Ho Chi Minh City, whoever is looking and
wherever their phone is. We store the day and the time as plain text and never convert them. The
time box says whose clock it is ("Time (Vietnam time)") so nobody has to guess.

### Putting things in order inside a day

Each item gets a number: Full day comes first, then Morning, Afternoon and Evening, each placed
at the start of its range (Morning before 12:00, Afternoon 12:00 to 16:59, Evening from 17:00).
An exact time sorts just after the part of day it falls in. So the order reads Full day,
Morning, 09:30, Afternoon, 12:00, Evening, 19:30. Items with the same number keep the order they
were added.

### Taking something off the schedule

For an idea, "Back to approved ideas" just removes its schedule item, so it shows in the Approved
list again. For a new item, Delete removes it for good, after one question. Deleting an idea, or
a whole trip, removes their schedule items too, because the database follows the links.

### This one needs a live database update too

Like Ideas and Voting, this adds a table, so the live database needs a migration. Nothing in the
live code uses the table yet, so it can run before the new code goes out, with the owner's OK.

## Chapter 10: Guests and spots

### A spot, not just a person

Until now a trip's member list was a list of accounts: one row per person who signed in. To let
you add a friend who won't sign up, each row in that list is now a "spot". A spot is either a
signed-in person or a guest, which is just a name that you typed in, with a note of who added
it. A rule in the database says a spot is always exactly one of those two, never both and never
neither. Every spot also has its own number, so we can point at it.

### Why claiming a guest's spot moves nothing

When your friend later opens the invite link and says "that's me", we don't create a new spot and
copy things across. We fill in their account on the guest's own spot, in a single step, and clear
the guest name. The spot keeps its number and its place in the list. That matters for money: when
shared costs arrive, they will point at the spot, not at a person. So a cost that was split with
"Lito" is still split with the same spot after Lito signs in, and every balance stays right.

### The rules around guests

A guest name can only be used once in a trip, and capital letters don't count (Lito and LITO are
the same). Only the person who added a guest, or the trip owner, can rename or remove them, and
the database checks that as part of the change itself. Someone who is just a guest, with no
account, can't see or change anything, because trip access is always checked against a real
signed-in account. A visitor who isn't signed in never sees a guest's name, only a circle in the
count.

### This one needs a live database update too

This changes the member table, so the live database needs a migration. It is built so the live
code keeps working before and after it: existing members just get their own spot numbers and
nothing is deleted or rewritten. It can run before the new code goes out, with the owner's OK.

## Chapter 11: Logging shared costs

### Money is whole pieces, never decimals

Computers can't hold 0.1 exactly as a decimal, and the tiny errors add up. So an amount is never
stored as 1000.50. It is stored as a whole number of the smallest piece of that money: 100,050
centavos for ₱1,000.50. Yen, won and dong have no smaller piece, so for them the whole number is
just the amount. Everything we add, split and compare is whole numbers, and the amount is only
turned into a friendly "₱1,000.50" when it is shown. When you type an amount, we read the text
itself and refuse anything the currency can't hold, like "1250.505" in pesos.

### The extra centavo

₱1,000.00 split three ways is 333.33 each, with one centavo left over. We never lose it and we
never invent it. One person takes the extra piece, so the shares are 333.34, 333.33 and 333.33,
and they always add up to the total. The rule is the same every time: the person who paid takes
the extra if they are sharing the cost, otherwise the first person in the trip's list. The review
step tells you who got it, so it is never a surprise.

### A review step that checks again on Save

After you tap Review, the server checks what you typed, works out the split and shows it back. When
you tap Save, the server does all of that again from your typed values; it does not trust the
numbers that were on the review screen. A cost is also saved under an id made when the page
opened, so a double tap saves one cost. When you edit, the page remembers when you opened the cost.
If someone else saved a change in the meantime, you see "Someone just changed this cost" with the
fresh values, instead of quietly overwriting their work.

### Costs point at spots

Like claiming a guest's spot, a cost points at spots, not at accounts. A guest can pay or share a
cost, and when that friend later joins and takes over their spot, every cost stays right. A guest
who's in a cost can't be removed, and the database enforces that too. Deleting a whole trip deletes
its costs first, in the same step.

### This one needs a live database update too

This adds two new tables, `cost` and `cost_share`. The live code doesn't use them yet, so the
migration can run before the new code goes out, with the owner's OK.

## Chapter 12: Leaving a trip without losing the costs

### The problem

People should be able to leave a trip, and the owner should be able to remove someone. But a
person who paid for the boat is part of that cost forever. If we delete their row from the trip,
the cost has nobody to point at. The database even refuses the delete, on purpose.

### The idea: mark it, don't delete it

This is called a soft delete. Think of a restaurant table with a "reserved" card on it: the table
is still there, nobody can sit at it, and the bill that mentions it still makes sense. We add one
column to the trip's list of people, `left_at`. Empty means "still in". A time means "left or was
removed at that moment". The row stays, so every cost keeps pointing at a real spot.

### One check makes it safe

Soft deletes go wrong when you forget to hide the marked row somewhere. Here every "is this person
in the trip" question already goes through a few places in the privacy layer (`isMemberOf` and the
checks in `trips.ts`). Each one now also asks "and `left_at` is empty". So the moment someone is
marked, they lose the trip, the ideas, the schedule and the costs at once, with no screen to
update. The test file for this checks a person who left against every read and write.

### Coming back, and handing over

If the person opens the invite link again, we clear `left_at` on the same row, so they are back
with their old costs. If you don't want that, the owner can get a new invite link: the old one
stops working right away. Handing over the trip is one change to `trip.owner_id`, a single
statement, so there is never a moment with no owner, and the owner can't leave until someone else
holds it.

### This one needs a live database update too

One new empty column, `trip_member.left_at`. The live code ignores it, so the migration can run
before the new code goes out, with the owner's OK.
