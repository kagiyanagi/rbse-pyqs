# RBSE Q-Bank — Next.js / Turso

Next.js 16 (App Router) port of the original Flask app. Reads questions from a Turso (libSQL) database via Drizzle ORM. Designed to deploy on Vercel free tier.

## Stack

- Next.js 16 + React 19, App Router, TypeScript
- Tailwind CSS v4 + shadcn/ui (radix primitives)
- Drizzle ORM + `@libsql/client`
- next-themes (light/dark)
- better-react-mathjax (MathJax 3 LaTeX rendering)
- Gemini 2.5 Flash for AI solutions — **client-side only**, user's key is read from `localStorage`. The server never sees a Gemini key.

## Setup

```bash
pnpm install
cp .env.local.example .env.local       # then fill in Turso URL + token
pnpm dev
```

Required env vars:
- `TURSO_DATABASE_URL` — `libsql://<db>-<org>.<region>.turso.io`
- `TURSO_AUTH_TOKEN` — `turso db tokens create <db>` output
- `NEXT_PUBLIC_GA_ID` — optional GA4 measurement ID

## One-time data migration

Schema is pushed straight from the Drizzle definition; data is copied row-by-row from the local `../questions.db` into Turso.

```bash
# 1. push schema
pnpm exec drizzle-kit push

# 2. copy 4366 rows
pnpm exec tsx scripts/migrate-from-sqlite.ts
```

Re-run the migration anytime the upstream Python pipeline rebuilds `questions.db` — it truncates and re-inserts.

## Deploy to Vercel

```bash
vercel link
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
# optional:
vercel env add NEXT_PUBLIC_GA_ID
vercel --prod
```

Vercel auto-detects Next.js — no `vercel.json` needed.

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
│   ├── gemini.ts            # client-side SSE stream helper + prompt template fill
│   └── api.ts               # typed fetch wrappers
├── components/
│   ├── browse/              # FilterBar, ResultsList, QuestionCard, ProbabilityBadge
│   ├── bookmarks/           # BookmarksTab
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
| Multi-DB switcher (`?db=`) | ❌ dropped — single Turso DB |

LocalStorage keys are unchanged from the Flask app (`rbse_bookmarks`, `theme`, `geminiKey`, etc.) — switching domains will not preserve them, but staying on the same domain will.
