#!/usr/bin/env python3
"""Parse official RBSE blueprint pages (the 2 "प्रश्न-पत्र की योजना / ब्लूप्रिंट" pages that precede each model paper)
into scripts/predict/blueprints.json with Gemini.

Usage: GEMINI_API_KEY=... python scripts/predict/parse_blueprints.py --pdf-dir <dir with <subject>_<yy>.pdf> [--out scripts/predict/blueprints.json]
Existing entries are kept; only missing (subject, year) pairs are parsed."""
import argparse, glob, json, os, sys, time
from google import genai
from google.genai import types

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPT = """This PDF is the official RBSE (Rajasthan Board) Class 12 question-paper blueprint pages ("प्रश्न-पत्र की योजना" and "ब्लूप्रिंट") for {subject}, exam year {year}. The Hindi may be typeset in a legacy font; read the page visually.
Return JSON only:
{{"total_marks": number, "duration": string, "units": [{{"unit_no": int, "name_hindi": string, "name_english": string, "marks": number, "by_type": {{"<question type>": marks}}}}],
 "question_types": [{{"type": string, "marks_each": number, "count": int}}], "objective_weightage": {{"<objective>": marks}}, "notes": string}}
Units are the syllabus units/chapters listed in the blueprint table with their marks total (सर्वयोग column). Give name_english as the standard NCERT unit/chapter name. by_type is the marks split of that unit across question types if the table gives it (columns like वस्तुनिष्ठ, रिक्त स्थान, अति लघुत्तरात्मक, लघुत्तरात्मक, दीर्घ उत्तरात्मक, निबंधात्मक). question_types: overall counts of each question type and marks per question in the paper. Use null for anything not present."""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf-dir", required=True)
    ap.add_argument("--out", default=os.path.join(HERE, "blueprints.json"))
    ap.add_argument("--model", default="gemini-2.5-flash")
    args = ap.parse_args()
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("set GEMINI_API_KEY")
    client = genai.Client(api_key=key)
    out = json.load(open(args.out)) if os.path.exists(args.out) else {}
    for f in sorted(glob.glob(os.path.join(args.pdf_dir, "*.pdf"))):
        subj, yy = os.path.basename(f)[:-4].split("_")
        year = 2000 + int(yy)
        k = f"{subj}_{year}"
        if k in out:
            continue
        for attempt in range(6):
            try:
                r = client.models.generate_content(model=args.model, contents=[types.Part.from_bytes(data=open(f, "rb").read(), mime_type="application/pdf"), PROMPT.format(subject=subj, year=year)],
                                                   config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0))
                out[k] = json.loads(r.text)
                print(f"{k}: total={out[k].get('total_marks')} units={len(out[k].get('units') or [])}", flush=True)
                break
            except Exception as e:
                msg = str(e)
                print(f"  retry {k}: {msg[:100]}", flush=True)
                time.sleep(60 if ("429" in msg or "RESOURCE" in msg) else 10)
        json.dump(out, open(args.out, "w"), ensure_ascii=False, indent=1)
        time.sleep(8)


if __name__ == "__main__":
    main()
