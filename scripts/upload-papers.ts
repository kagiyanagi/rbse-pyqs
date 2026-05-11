// One-shot uploader: walks a local `papers/` directory and uploads every file
// to the project's Vercel Blob store, preserving the relative path so the
// public URL ends in `/papers/<subject>/<file>.pdf` and matches the
// `source_file` column in the questions table.
//
// Usage:
//   1. Pull the blob token: `vercel env pull .env.local`
//   2. Run: `pnpm tsx --env-file=.env.local scripts/upload-papers.ts <papers-dir>`
//
// Re-runs are idempotent (allowOverwrite + addRandomSuffix:false).

import { put } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.argv[2];
if (!ROOT) {
  console.error("usage: tsx scripts/upload-papers.ts <local-papers-dir>");
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error(
    "BLOB_READ_WRITE_TOKEN missing. Run `vercel env pull .env.local` first, then re-run with `pnpm tsx --env-file=.env.local …`",
  );
  process.exit(1);
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

async function main() {
  const root = path.resolve(ROOT);
  const leaf = path.basename(root);
  let count = 0;
  let bytes = 0;
  const hosts = new Set<string>();

  for await (const file of walk(root)) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    // If the user passed the `papers/` folder itself, mirror it under `papers/`
    // so the public URL matches the source_file column. If they passed the
    // parent (so `rel` already starts with `papers/`), use as-is.
    const pathname = leaf === "papers" ? `papers/${rel}` : rel;
    const body = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    const contentType =
      ext === ".pdf" ? "application/pdf"
      : ext === ".png" ? "image/png"
      : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : undefined;
    const result = await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
    });
    const u = new URL(result.url);
    hosts.add(`${u.protocol}//${u.host}`);
    count++;
    bytes += body.length;
    if (count % 10 === 0) console.log(`uploaded ${count} files…`);
  }

  console.log(`\ndone: ${count} files, ${(bytes / (1024 * 1024)).toFixed(1)} MB`);
  for (const host of hosts) {
    console.log(`\nset this in Vercel + .env.local:`);
    console.log(`  NEXT_PUBLIC_PAPERS_BASE_URL=${host}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
