#!/usr/bin/env python3
"""Embed PCM question texts with Gemini (gemini-embedding-001, 768 dims) into an incremental cache
<prefix>_ids.json + <prefix>_vecs.npy that build_predictions.py consumes via --embeddings <prefix>.

Usage: GEMINI_API_KEY=... python scripts/predict/embed_questions.py --db ../questions.db --out scripts/predict/emb
Re-running only embeds new or changed questions."""
import argparse, hashlib, json, os, sqlite3, sys, time
import numpy as np
from google import genai
from google.genai import types


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--out", required=True, help="cache prefix")
    ap.add_argument("--batch", type=int, default=20)
    args = ap.parse_args()
    keys = [k for k in os.environ.get("GEMINI_API_KEYS", os.environ.get("GEMINI_API_KEY", "")).replace(",", " ").split() if k]
    if not keys:
        sys.exit("set GEMINI_API_KEYS (comma-separated; the free tier allows ~1000 texts per key per day)")
    ki = 0
    client = genai.Client(api_key=keys[ki])
    rows = sqlite3.connect(args.db).execute("select id, question_text from questions where lower(subject) in ('physics','chemistry','mathematics') and year is not null order by id").fetchall()
    ids_f, vec_f = args.out + "_ids.json", args.out + "_vecs.npy"
    cache = json.load(open(ids_f)) if os.path.exists(ids_f) else {}
    vecs = list(np.load(vec_f)) if os.path.exists(vec_f) else []
    h = lambda t: hashlib.md5((t or "").encode()).hexdigest()[:12]
    todo = [(i, (t or "")[:2000]) for i, t in rows if str(i) not in cache or cache[str(i)]["h"] != h(t or "")]
    print(f"{len(rows)} rows, {len(todo)} to embed", flush=True)
    for k in range(0, len(todo), args.batch):
        batch = todo[k:k + args.batch]
        strikes = 0
        while True:  # round-robin over keys; a 429 is a per-minute token limit, so move to the next key and pace
            try:
                res = client.models.embed_content(model="gemini-embedding-001", contents=[t for _, t in batch],
                                                  config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY", output_dimensionality=768))
                break
            except Exception as e:
                msg = str(e)
                strikes += 1
                if strikes > 60:
                    sys.exit(f"giving up at {k}/{len(todo)}: {msg[:120]}")
                ki = (ki + 1) % len(keys)
                client = genai.Client(api_key=keys[ki])
                if strikes % len(keys) == 0:
                    print(f"  all keys limited at {k}; waiting 30s ({msg[:60]})", flush=True)
                    time.sleep(30)
                else:
                    time.sleep(2)
        ki = (ki + 1) % len(keys)
        client = genai.Client(api_key=keys[ki])
        for (i, t), emb in zip(batch, res.embeddings):
            v = np.asarray(emb.values, dtype=np.float32)
            v /= (np.linalg.norm(v) or 1)
            if str(i) in cache:
                vecs[cache[str(i)]["row"]] = v
            else:
                cache[str(i)] = {"h": h(t), "row": len(vecs)}
                vecs.append(v)
        json.dump(cache, open(ids_f, "w"))
        np.save(vec_f, np.stack(vecs))
        print(f"  {min(k + args.batch, len(todo))}/{len(todo)}", flush=True)
        time.sleep(1)
    print("done", flush=True)


if __name__ == "__main__":
    main()
