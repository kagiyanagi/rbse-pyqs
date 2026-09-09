# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                 # next dev (Turbopack)
pnpm build               # next build
pnpm lint                # eslint (flat config, next/core-web-vitals + typescript)
pnpm exec tsc --noEmit   # typecheck; `scripts/` is excluded from tsconfig
```

Data tasks (both need `TURSO_*` in `.env.local`):

```bash
pnpm exec drizzle-kit push                        # push src/db/schema.ts to Turso
pnpm exec tsx scripts/migrate-from-sqlite.ts      # truncate + copy ../questions.db into Turso
pnpm tsx --env-file=.env.local scripts/upload-papers.ts <papers-dir>   # needs BLOB_READ_WRITE_TOKEN
```

There is no test framework in this repo. Verification is lint, typecheck, and running the app.

## Architecture

A Next.js 16 App Router port of an earlier Flask app. One read-only Turso (libSQL) table of RBSE Class 12 past questions, plus per-user state that never touches the app server.

**Server side is thin and read-only.** `src/db/client.ts` throws at import time if `TURSO_DATABASE_URL` is unset, so any route importing it fails without env. Route handlers under `src/app/api/` only select; nothing writes to Turso at runtime. All API responses are sent with `Cache-Control: no-store` from `next.config.ts`.

**Canonical chapter names are the core domain problem.** The `chapter` column holds duplicates, typos, and older-syllabus names. `src/lib/syllabus.ts` owns the canonical subject and chapter lists and `canonicalizeChapter`, which normalizes (case, punctuation, leading "the"), applies a typo table, extracts Hindi/English lesson codes like `Lhar101`, splits multi-chapter strings, and otherwise returns the `Older / out-of-syllabus` bucket. `src/lib/syllabus-aliases.ts` builds the reverse map lazily from distinct DB rows. The questions route expands a canonical chapter filter back into every raw variant before building the SQL. Any new chapter-aware feature must go through these two modules rather than matching the raw column.

**Two lazy in-process caches**, both a memoized promise with an `invalidate*` export: `getProbCache` in `src/lib/prob-cache.ts` (per-chapter appearance probability, year breakdown, top topics) and `getChapterAliases`. They persist for the lifetime of a serverless instance, so a data migration is not reflected until instances recycle.

**Filters are URL-search-param driven end to end.** `src/lib/filters.ts` parses repeated params with a legacy singular fallback, handles the `"5+"` open-ended marks bucket, and builds the Drizzle `where`. `target_marks_total` is a greedy pack over the first 500 ordered candidates, not a SQL limit.

**User state is local-first.** Bookmarks, notes, answered ids, settings, and cached solutions live in `localStorage` under keys carried over from the Flask app (`rbse_bookmarks`, `rbse_answered`, `rbse_solutions`, `geminiKeys`, `theme`, …); renaming one silently drops existing users' data. `src/hooks/use-local-storage.ts` is the single primitive, built on `useSyncExternalStore` with a module-level subscriber registry so multiple components sharing a key stay in sync, and a `hydrated` flag because the server snapshot is always null. Firestore is an optional cross-device mirror, not a source of truth. `src/lib/firebase/sync.ts` holds explicit per-field merge functions, union for collections and remote-wins for settings. Firebase is entirely optional; when `NEXT_PUBLIC_FIREBASE_*` is absent, sign-in is hidden and everything else works.

**Gemini runs in the browser only.** The server never sees a key. `src/lib/gemini.ts` streams Server-Sent Events straight to Google, and `streamGeminiWithRotation` walks the user's keys in cooldown order, rotating on 401/403/429 but only before the first chunk is yielded, since mid-stream retry would duplicate emitted text. Answer length is steered by `marksGuidance`, keyed off the question's mark value, and the prompt is a user-editable template filled by `fillTemplate`.

**Two math renderers coexist, deliberately.** Question text goes through MathJax, whose provider is mounted in the root layout and accepts `$…$`, `$$…$$`, `\(…\)` and `\[…\]`. Notes, AI solutions and the print/export view go through KaTeX, via react-markdown with remark-math and rehype-katex, which only understands the dollar forms. Anything rendering question text outside a card must normalize the TeX delimiters first, which is what `toMarkdownSafe` in `src/lib/export.ts` does. `src/lib/text.ts` repairs the source data before either renderer sees it: it closes odd unbalanced `$` on math-looking lines and unwraps stray whole-line `\text{...}`.

**Export and print** live in `src/lib/export.ts` and `src/components/export/`. `questionDisplayText` is the one place that turns a row plus a language mode into display text, and the question card, the print view and the file writers all call it, so a printed question matches the card exactly. Question text is plain text that merely contains LaTeX, so `toMarkdownSafe` escapes markdown specials outside math spans, leaves the spans themselves intact, and promotes a standalone display span into its own fenced block, since remark-math only centres `$$` when it fences a block on its own lines. PDF output is the browser's own print dialog against a `#print-root` portal that the `@media print` rules in `globals.css` isolate, chosen because KaTeX typesets synchronously during the React commit while MathJax would print half-rendered.

**Text scaling** is two CSS custom properties, `--question-scale` and `--ui-scale`; the UI one multiplies the html root font-size.

## Conventions

- Path alias `@/*` maps to `src/*`.
- UI is shadcn/ui over Radix in `src/components/ui/`; add primitives with the shadcn CLI rather than hand-writing them.
- API payloads use snake_case (`question_text`, `chapter_stats`) while Drizzle rows are camelCase; the mapping happens in the route handler.
- `src/app/page.tsx` is a client component that owns filter state and the fetch; tabs are Browse, Bookmarks, Progress.
