# RBSE Q-Bank - Next.js / Turso

Next.js 16 (App Router) port of the original Flask app. Reads questions from a Turso (libSQL) database via Drizzle ORM. Designed to deploy on Vercel free tier.

## Stack

- Next.js 16 + React 19, App Router, TypeScript
- Tailwind CSS v4 + shadcn/ui (radix primitives)
- Drizzle ORM + `@libsql/client`
- next-themes (light/dark)
- better-react-mathjax (MathJax 3 LaTeX rendering)
- Gemini 2.5 Flash for AI solutions - **client-side only**, user's key is read from `localStorage`. The server never sees a Gemini key.

## Setup

```bash
pnpm install
cp .env.local.example .env.local       # then fill in Turso URL + token
pnpm dev
```

Required env vars:
- `TURSO_DATABASE_URL` - `libsql://<db>-<org>.<region>.turso.io`
- `TURSO_AUTH_TOKEN` - `turso db tokens create <db>` output
- `NEXT_PUBLIC_GA_ID` - optional GA4 measurement ID

Optional (for accounts + cross-device sync):
- `NEXT_PUBLIC_FIREBASE_*` - see [Firebase setup](#firebase-setup) below. The app
  works fully without these; sign-in just won't be available.

## One-time data migration

Schema is pushed straight from the Drizzle definition; data is copied row-by-row from the local `../questions.db` into Turso.

```bash
# 1. push schema
pnpm exec drizzle-kit push

# 2. copy 4366 rows
pnpm exec tsx scripts/migrate-from-sqlite.ts
```

Re-run the migration anytime the upstream Python pipeline rebuilds `questions.db` - it truncates and re-inserts.

## Firebase setup

Auth + cross-device sync are optional. If `NEXT_PUBLIC_FIREBASE_*` vars are
missing, the sign-in button is hidden and everything else works on
`localStorage` alone.

When you do enable Firebase:

**1. Create a project** at [console.firebase.google.com](https://console.firebase.google.com).

**2. Authentication → Sign-in method**
- Enable **Google**.
- Enable **Email/Password** (leave "Email link" off).
- Under **User account linking**, choose **"Link accounts that use the same email"**.
  This makes the link/unlink flow auto-merge same-email accounts.

**3. Authentication → Settings → Authorized domains**
- `localhost` is added by default.
- Add your production domain when you deploy.

**4. Firestore Database → Create database**
- Pick **Production mode** (not Test mode) - we ship proper rules.
- Choose a location close to your users (e.g. `asia-south1` for India).
- Paste [`firestore.rules`](./firestore.rules) into **Firestore → Rules** and Publish.

**5. Project settings → General → Your apps → Web app `</>`**
- Register a web app and copy the `firebaseConfig` snippet.
- Put each value into `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

The Firebase web `apiKey` is **public by design** - it just identifies the
project. Real security comes from the Firestore rules and the Authorized
domains list.

### What's stored where

| Data | Where | Notes |
|---|---|---|
| Bookmarks, notes, answered, settings | `localStorage` + Firestore (when signed in) | Local-first; Firestore is a cross-device mirror |
| First / last name | `localStorage` + Firestore | Synced |
| Profile picture | `localStorage` only | Never uploaded to any server |
| Gemini API key | `localStorage` only | Never synced |

Firestore layout per user:

```
users/{uid}                            { firstName, lastName, updatedAt }
users/{uid}/userdata/state             { bookmarks, bookmarkNotes, answered, settings, updatedAt }
```

## Deploy to Vercel

```bash
vercel link
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
# optional:
vercel env add NEXT_PUBLIC_GA_ID
# optional Firebase (one entry per NEXT_PUBLIC_FIREBASE_* key)
vercel --prod
```

Vercel auto-detects Next.js - no `vercel.json` needed.

## What's where

```
src/
├── app/
│   ├── layout.tsx           # theme + MathJax providers
│   ├── page.tsx             # main UI orchestrator
│   ├── globals.css          # Tailwind v4 + theme tokens + scale CSS vars
│   └── api/                 # route handlers (subjects/chapters/topics/questions/stats/health)
├── db/{schema.ts, client.ts}
├── lib/
│   ├── filters.ts           # search-param parsing + marks "5+" buckets
│   ├── prob-cache.ts        # per-chapter probability stats (in-process cache)
│   ├── export.ts            # display text, markdown/LaTeX writers, math-safe escaping
│   ├── gemini.ts            # client-side SSE stream helper + prompt template fill
│   └── api.ts               # typed fetch wrappers
├── components/
│   ├── browse/              # FilterBar, ResultsList, QuestionCard, ProbabilityBadge
│   ├── bookmarks/           # BookmarksTab
│   ├── export/              # ExportDialog + print-only PrintDocument
│   ├── settings/            # SettingsModal
│   ├── solution/            # SolutionModal (streaming AI answer)
│   ├── multi-select.tsx     # popover + search + checkboxes
│   ├── bookmark-picker.tsx
│   ├── text-size-popover.tsx
│   ├── math-content.tsx
│   ├── theme-provider.tsx
│   └── ui/                  # shadcn primitives
└── hooks/
    ├── use-local-storage.ts # SSR-safe primitive with cross-component sync
    ├── use-bookmarks.ts
    ├── use-answered.ts
    ├── use-text-size.ts
    ├── use-language.ts
    └── use-settings.ts
```

## Predicting what comes next (PCM)

Every current-syllabus Physics, Chemistry and Mathematics question carries three numbers for the
next main paper: the chance that **this or a very similar question** is asked, that a
**near-verbatim copy** is asked, and that **any question on its topic** is asked. Expand the badge
to see every past appearance (real papers and official model papers), the chapter's marks in the
board's official blueprint and in recent papers, and how much of recent papers were repeats. Sort by
**Most likely next** for a study list ranked by that chance, one card per question family; combine it
with a marks target to pack a "most likely" paper. The **Repeat chance** filter keeps only the bands you
pick (High is 20% or more, Above average 10 to 20%, Average 4 to 10%, Low under 4%); it applies to PCM
questions only, since Hindi and English have no prediction.

The numbers come from `scripts/predict/build_predictions.py`:

1. **Evidence.** Real papers (main, set 2, supplementary) plus the official RBSE model papers, which
   the extraction pipeline stores as `paper_type = "model"`. "OR" alternatives are weighted so a
   choice between two questions counts as one slot.
2. **Families and topics.** Near-duplicates are clustered into families with a lexical similarity
   (character n-gram TF-IDF on the English/maths text plus topic-keyword overlap, never across
   chapters), so different compounds or constants stay different questions. Related questions are
   grouped into topics with a semantic similarity that can blend Gemini embeddings
   (`embed_questions.py`).
3. **Recurrence.** Each family gets a recency-decayed count of its appearances, with partial credit for
   related questions and a fitted weight for model papers; each chapter's expected number of
   questions is split over its families in proportion to that score and multiplied by the measured
   reuse rate. The topic layer runs the same kernel at topic granularity.
4. **Blueprint.** The official blueprint tables that precede each model paper are parsed by
   `parse_blueprints.py` and give the chapter marks; recent papers give the range.
5. **Honest backtests.** Every backtest mirrors the real situation for the target year: the newest
   real paper is two years old and the newest model paper one year old. Hyper-parameters are tuned by
   out-of-sample log-loss on older target years; the last two real papers are held out and reported
   (AUC, log-loss, coverage of the paper by the top-K predicted families, calibration). A logistic
   stacker over the chapter kernel, the slot-aware kernel and the topic layer is used only where it
   beats the kernel on those held-out years.

```bash
pip install -r scripts/predict/requirements.txt
python scripts/predict/merge_model_papers.py --base ../rbse-qbank/questions.db --extra <unfiltered-latex.db> --out ../questions.db
GEMINI_API_KEY=...  python scripts/predict/parse_blueprints.py --pdf-dir <dir of <subject>_<yy>.pdf blueprint pages>
GEMINI_API_KEYS=k1,k2 python scripts/predict/embed_questions.py --db ../questions.db --out scripts/predict/emb   # optional
python scripts/predict/build_predictions.py --embeddings scripts/predict/emb                                    # writes src/data/predictions.json
```

Re-run the last step whenever `questions.db` is rebuilt. Hindi and English keep the older
chapter-level badge.

Current backtest (target 2027, held-out real papers 2024 and 2025, newest real paper two years old):

| Subject | AUC | top-100 families cover | ceiling | topic AUC | top-100 topics cover |
|---|---|---|---|---|---|
| Physics | 0.71 | 22% / 9% | 37% / 34% | 0.80 / 0.70 | 55% / 45% |
| Chemistry | 0.78 | 15% / 13% | 23% / 30% | 0.80 / 0.78 | 38% / 45% |
| Mathematics | 0.78 (stacker) | 29% / 21% | 37% / 40% | 0.79 / 0.82 | 72% / 71% |

Findings baked into the defaults: official model papers are useful evidence for physics and maths but
the board does not copy them into the real paper (under 6% of a real physics or chemistry paper matches
its model paper, about 15% for maths); Gemini embeddings lowered every AUC and stay off; slot-aware
allocation by marks bucket lost to chapter-level allocation in all three subjects.

Held-out results for the 2027 build (2024 and 2025 real papers, forecast as if from two years
earlier): question-family AUC 0.71 physics, 0.78 chemistry, 0.78 mathematics against a constant
baseline of 0.5; topic-level AUC 0.68 to 0.81. Studying the top 100 predicted families covered 13 to
26 percent of those papers, against a ceiling of 23 to 40 percent (the share of each paper that
repeats anything from the available history); the top 100 topics covered 34 to 71 percent. Gemini
embeddings were evaluated and rejected: blended into the similarity they lowered AUC in chemistry and
mathematics because the "same question" here is entity-specific (a different compound or constant is a
different question), which lexical similarity respects.

## Exporting a question list

The **Export** button sits next to the search box in Browse, and next to **Clear**
in Bookmarks. It exports exactly what is on screen - the filtered, searched list,
with hidden-answered questions already removed.

| Format | How it works | Use it for |
|---|---|---|
| **PDF** | Opens the browser print dialog on a print-only view; choose "Save as PDF" | Handouts, revision sheets, anything you print |
| **Markdown** (`.md`) | Downloads a file with math left in `$…$` / `$$…$$` | Obsidian, Notion, GitHub, further editing |
| **LaTeX** (`.tex`) | Downloads a compilable document | Typesetting a real paper |

Options: title, language (per-card, English, हिन्दी, or both), whether to include
chapter/topic, your notes and saved AI solutions, and how much blank answer space
to leave under each question.

Math is typeset with KaTeX rather than MathJax, because KaTeX renders
synchronously and is therefore fully laid out before the print dialog opens.
Question text is plain text that happens to contain LaTeX, so markdown specials
outside math spans (`_`, `*`, a leading `#`) are escaped and the math spans are
passed through untouched - subscripts stay subscripts instead of turning into
italics. `\(…\)` and `\[…\]` are rewritten to the dollar forms, which is all
remark-math understands.

A `.tex` export containing Devanagari needs XeLaTeX or LuaLaTeX plus a
Devanagari font; the generated preamble says so and sets up `fontspec` for you.

## Feature parity vs the Flask version

| Feature | Status |
|---|---|
| Multi-select filters (subject/chapter/topic/marks/question_type) | ✅ |
| `min_year` slider | ✅ |
| Sort modes (newest/oldest/random/marks_asc/marks_desc) | ✅ |
| `count` vs `target_marks_total` | ✅ |
| LaTeX dual-storage (text + latex) | ✅ |
| Probability badge with year-by-year expansion + top topics | ✅ |
| Bookmarks (custom categories + Answered pseudo-category) | ✅ |
| Mark-answered + hide-answered | ✅ |
| AI solution streaming (Gemini, user's key, marks-aware) | ✅ |
| Light/dark theme | ✅ |
| EN / हि / EN+हि per-card cycle | ✅ |
| Search-in-results highlight | ✅ |
| Floating text-size popover (question + UI scales) | ✅ |
| Customizable AI prompt template | ✅ |
| GA4 (via `NEXT_PUBLIC_GA_ID`) | ✅ |
| Export results to PDF / Markdown / LaTeX | ✅ |
| Question-level repeat chance + "Most likely next" sort (PCM) | ✅ new |
| Multi-DB switcher (`?db=`) | ❌ dropped - single Turso DB |

LocalStorage keys are unchanged from the Flask app (`rbse_bookmarks`, `theme`, `geminiKey`, etc.) - switching domains will not preserve them, but staying on the same domain will.
