# NEXORA 0.7 — Scene Assistants

**Learn. Build. Explore. Become.** — The Learning Operating System.
Founded and designed by M. Chinnakotla.

## Start it (2 minutes)

The database is already set up in your Supabase project **nexora** and already holds the
AutoCAD for Beginners course (12 experiences, EN + ES). You only need Node.js.

**Mac:** unzip, then double-click **`START-NEXORA.command`**.
(First time macOS may say it is from an unidentified developer: right-click it → **Open** → **Open**.)

**Windows:** double-click **`START-NEXORA-Windows.bat`**.

**Or in Terminal:**
```bash
cd nexora
npm install
npm run dev
```
Then open http://localhost:3001.

If Node.js is missing, install the LTS version from https://nodejs.org first.

## First thing to do

1. Click **Sign in → Create an account**. **The first account becomes the platform admin**
   and the owner of the AutoCAD course — so make it yours.
2. Confirm the email Supabase sends you (open the link on the same computer).
3. Go to **Classrooms → Create class**. You get a join code like `NXR-4821`.
4. Open any AutoCAD lesson → **Present**. Students scan the QR or type the code.

Demo accounts (one click on the sign-in page) let you see the student side. Turn them off in
**Admin → Feature flags → demo_accounts** before inviting real students.

## Using it with real students (put it online)

`localhost` only works on your own computer — students' Chromebooks can't reach it.
To put NEXORA on the internet for free:

```bash
npm run deploy
```
This runs Vercel's installer: sign in with GitHub or email, accept the defaults. You get a
link like `https://nexora-xxxx.vercel.app`. Then, in the Supabase dashboard →
**Authentication → URL Configuration**, set **Site URL** to that link and add
`https://nexora-xxxx.vercel.app/**` under **Redirect URLs**, so confirmation emails point there.

Recommended for classes: Supabase → **Authentication → Sign In / Providers → Email** →
turn off **Confirm email**, so students can sign up without waiting for an email
(many school inboxes block outside mail).

## What's new in 0.5 — Checks (Do Now and Exit Ticket engine)

- **Class → Add Materials → “Do Now (auto-generate)” / “Exit Ticket (auto-generate)”**, or any
  file's ⚙ menu → “Make a Do Now / Exit Ticket from this”.
- NEXORA reads the lesson (PDF, .docx, .pptx, .xlsx, web page, Google Docs/Slides/Sheets link shared
  “anyone with the link”, pasted text, or a library experience) and writes the number of questions
  you choose of each type: True/False, Multiple Choice, Ordering, Short-Answer/Essay, Fill in the
  Blank, Matching.
- Review in the editor (Questions · Settings · Preview · Results). Add Question menu like Schoology,
  plus Generate more, Question Banks, Import Test/Quiz (paste from Word), Page Break and Text.
  Every change saves automatically. **Publish** → it appears in Materials, Today in class and Nova.
- Students answer on the website. Everything except written answers is graded instantly (partial
  credit for ordering, matching and multi-blank). Answer keys never reach the student's browser.
- Results update live: who turned in, average, % correct per question, grading of written answers
  with feedback, “let them retake”, CSV export. Checks also show in the Gradebook tab.

### The two engines
- **Built-in engine (default, free):** works from the lesson's text — terms and definitions, step
  lists, the essential question, “I can” targets and summary points. Good starting questions; review
  before publishing.
- **AI engine (optional, much better):** add an environment variable `ANTHROPIC_API_KEY` in Vercel
  (Project → Settings → Environment Variables), then redeploy. It also reads scanned PDFs and
  pictures and can write Spanish or bilingual questions. Default model `claude-sonnet-5-5`
  (override with `ANTHROPIC_MODEL`). Cost is a few cents per check.

## What was new in 0.4 — Nova

- **Plan the day once, Nova tells every student.** When you add a file, link, page or
  assignment, pick *What is it?* (Do Now, Lecture, Activity, Homework, Exit ticket, Resource),
  the *Lesson day* (Today is pre-selected) and an optional *Due* date. Items you already have:
  ⚙ menu → **Make it today's Do Now** / **Make it today's lecture** / **Day, tag and due date…**
- **Today in class** appears at the top of each course page and on student Home.
- **Ask Nova** — students click the fox: today's Do Now, the lecture, what's due, what they
  missed, how to turn in work, grades, where things are (EN + ES). Teachers get today's plan
  and ungraded work. No AI service: Nova only reads your class data through the same
  permissions as the student.
- **Nova is alive.** Watches the pointer, ears perk when you come near, loves being petted
  (stroke back and forth over it), tumbles when kicked (swipe fast through it) and runs off
  after three kicks, can be picked up and dropped, eats treats, chases a ball, does a backflip
  and howls. Play buttons are in the panel too (keyboard and touch friendly). Fox sounds are
  off until a student turns them on in the panel.

## What was new in 0.3 — Connected

- **Upload anything.** Teach → New experience → *Upload file*. PDF, Word, PowerPoint, Excel,
  images, video, audio, text/code/CSV/Markdown, HTML, 3D models (GLB/GLTF) open right inside
  NEXORA; anything else (DWG, ZIP, SKP…) gets a download card with "Open in AutoCAD Web /
  SketchUp / Tinkercad / Onshape". Up to 50 MB per file.
- **Course pages like Schoology.** Every class has Materials (folders, files, links, pages,
  assignments, experiences, apps — publish/unpublish, move, rename), Updates (announcements,
  live), Gradebook, Members and Apps, plus Reminders (ungraded / re-submitted) and Upcoming.
- **App Center** (`/apps`). 25 built-in tools — Schoology, Google Classroom/Drive/Docs/Slides/
  Sheets/Forms, AutoCAD Web, Tinkercad, Onshape, SketchUp, Microsoft 365, Canva, YouTube,
  Edpuzzle, Nearpod, Kahoot!, Quizlet, Kami, Desmos, PhET, Khan Academy, iCEV, IXL, Britannica.
  **Add your own** (e.g. your puzzle website) with *Add your own app or website*, then **Pin**
  it to a class — with your own course link if you like (e.g. the Schoology course URL).
- **File submissions.** Students attach up to 10 files to an assignment; teachers open them in
  the built-in viewer.
- **Share out.** Every experience has *Share to Google Classroom* and *Copy link for Schoology*.
- Links from YouTube, Vimeo, Google Docs/Slides/Sheets/Forms/Drive, Canva, Loom, Figma,
  Sketchfab, PhET and Desmos are turned into embeds automatically.

Files are stored in Supabase Storage (buckets `experience-files` and `submission-files`,
created by migration `0005`). The free Supabase plan includes 1 GB of storage.

## The living interface (0.2)

- **Ambient light** — `src/components/AmbientField.tsx` + tokens at the top of `src/app/globals.css`
  (carbon, ember, signal red, violet, magenta; materials; motion). Each area has its own mood.
- **Nova the fox** — `src/components/companion/` (`Fox.tsx` is the SVG, `Companion.tsx` the behaviour).
  Name and species live in `src/lib/brand.ts` → `companion`.
- **Settings → Living interface** — Full / Reduced / Static and Companion on/off, saved per device.
  The device's "reduce motion" setting always wins. Presentation Mode never shows Nova.

## What is in 0.1

Landing page · sign-in/up (EN/ES before and after login) · student and teacher Home ·
Experience Library with Worlds and the AutoCAD learning path · experience pages with
objectives, teacher-only notes, worksheet download, content-language switch · full-screen
player · Classes with NXR join codes · Assignments, submissions, feedback, gradebook + CSV ·
Presentation Mode (QR, live join count, timer, announcements, EN / ES / BOTH) · Portfolio with
per-item visibility · Library (saved) · Teach: add/edit your own experiences in EN + ES,
versions, remix · Ctrl/⌘ K search · Admin: users & roles, feature flags, audit log ·
data export · dark mode · print layouts.

## Project map

```
src/app/(site)/        pages with the app shell (home, discover, classes, …)
src/app/(focus)/       full-screen pages: player and Presentation Mode
src/lib/actions.ts     every write (server actions) — calls row-level-secured tables/RPCs
src/lib/data.ts        reads
src/lib/brand.ts       product name, founder, version — change attribution here only
messages/en.ts, es.ts  every interface string (add a language = add a file)
supabase/migrations/   database schema, security policies, seed data
public/experiences/    the AutoCAD lesson sites, lectures and worksheets
```

Answer keys are intentionally **not** included in `public/` — keep them offline.

## Database

Migrations `0001`–`0007` in `supabase/migrations`. If the demo accounts or the newest
features say they are not set up, open Supabase → **SQL Editor**, paste
`supabase/RUN-ONCE-in-SQL-editor.sql`, and press **Run** (safe to run more than once).
