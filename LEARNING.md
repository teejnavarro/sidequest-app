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
| **Sign-in** | The host at the door with the guest list | Decides who is allowed in and who they are | Auth.js with Google (added later) |
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
