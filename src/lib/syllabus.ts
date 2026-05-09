// Canonical chapter normalization for RBSE Class 12.
// The DB has duplicate / typo / older-syllabus chapter names that all need
// to be merged into a single canonical bucket per subject.

export const OUT_OF_SYLLABUS = "Older / out-of-syllabus";

export const CANONICAL_CHAPTERS = {
  Physics: [
    "Electric Charge and Fields",
    "Electric Potential and Capacitance",
    "Current Electricity",
    "Moving Charges and Magnetism",
    "Magnetism and Matter",
    "Electromagnetic Induction",
    "Alternating Current",
    "Electromagnetic Waves",
    "Ray Optics and Optical Instruments",
    "Wave Optics",
    "Dual Nature of Radiation and Matter",
    "Atoms",
    "Nuclei",
    "Semiconductor Electronics",
  ],
  Chemistry: [
    "Solutions",
    "Electrochemistry",
    "Chemical Kinetics",
    "The D- and F-block Elements",
    "Coordination Compounds",
    "Haloalkanes and Haloarenes",
    "Alcohols, Phenols and Ethers",
    "Aldehydes, Ketones and Carboxylic Acids",
    "Amines",
    "Biomolecules",
  ],
  Mathematics: [
    "Relations and Functions",
    "Inverse Trigonometric Functions",
    "Matrices",
    "Determinants",
    "Continuity and Differentiability",
    "Application of Derivatives",
    "Integrals",
    "Application of Integrals",
    "Differential Equations",
    "Vector Algebra",
    "3D Geometry",
    "Linear Programming",
    "Probability",
  ],
  Hindi: [
    ...Array.from({ length: 15 }, (_, i) => `Lhar${101 + i}`),
    "Lhvt101",
    "Lhvt102",
    "Lhvt103",
  ],
  English: [
    ...Array.from({ length: 15 }, (_, i) => `Lefl${101 + i}`),
    ...Array.from({ length: 6 }, (_, i) => `Levt${101 + i}`),
  ],
} as const satisfies Record<string, readonly string[]>;

export type CanonicalSubject = keyof typeof CANONICAL_CHAPTERS;

export const CANONICAL_SUBJECTS: CanonicalSubject[] = Object.keys(
  CANONICAL_CHAPTERS,
) as CanonicalSubject[];

const SUBJECT_ALIASES: Record<string, CanonicalSubject> = {
  physics: "Physics",
  chemistry: "Chemistry",
  mathematics: "Mathematics",
  math: "Mathematics",
  maths: "Mathematics",
  hindi: "Hindi",
  english: "English",
};

export function canonicalSubject(s: string | null | undefined): CanonicalSubject | null {
  if (!s) return null;
  const k = s.toLowerCase().trim();
  return SUBJECT_ALIASES[k] ?? null;
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

// Known typo / variant overrides keyed by normalized form.
const KNOWN_TYPOS: Record<string, string> = {
  determinats: "Determinants",
  continuityanddfferentiability: "Continuity and Differentiability",
};

const _normIndex: Record<CanonicalSubject, Map<string, string>> = {
  Physics: new Map(),
  Chemistry: new Map(),
  Mathematics: new Map(),
  Hindi: new Map(),
  English: new Map(),
};
for (const subj of CANONICAL_SUBJECTS) {
  for (const c of CANONICAL_CHAPTERS[subj]) {
    _normIndex[subj].set(normKey(c), c);
  }
}

const LESSON_CODE_RE = /\bL(?:har|hvt|efl|evt)\d{3}\b/i;

function extractLessonCode(s: string): string | null {
  const m = s.match(LESSON_CODE_RE);
  if (!m) return null;
  const code = m[0];
  return code.charAt(0).toUpperCase() + code.slice(1, 4).toLowerCase() + code.slice(4);
}

function tryLookup(subj: CanonicalSubject, candidate: string): string | null {
  const k = normKey(candidate);
  const direct = _normIndex[subj].get(k);
  if (direct) return direct;
  const typo = KNOWN_TYPOS[k];
  if (typo && _normIndex[subj].has(normKey(typo))) return typo;
  return null;
}

/**
 * Map a (subject, chapter) to its canonical chapter name, or {@link OUT_OF_SYLLABUS}
 * if the chapter doesn't belong to the current syllabus. Subject-unaware callers
 * receive the trimmed string back.
 */
export function canonicalizeChapter(
  subject: string | null | undefined,
  chapter: string | null | undefined,
): string {
  if (!chapter) return OUT_OF_SYLLABUS;
  const trimmed = chapter.trim().replace(/\s+/g, " ");
  if (!trimmed) return OUT_OF_SYLLABUS;

  const subj = canonicalSubject(subject);
  if (!subj) return trimmed;

  const direct = tryLookup(subj, trimmed);
  if (direct) return direct;

  if (subj === "Hindi" || subj === "English") {
    const code = extractLessonCode(trimmed);
    if (code) {
      const v = tryLookup(subj, code);
      if (v) return v;
    }
  }

  // Multi-chapter strings like "A / B" or "A, B" — return the first canonical match.
  if (/[,/]/.test(trimmed)) {
    const parts = trimmed.split(/\s*[,/]\s*/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
      const v = tryLookup(subj, p);
      if (v) return v;
      if (subj === "Hindi" || subj === "English") {
        const code = extractLessonCode(p);
        if (code) {
          const v2 = tryLookup(subj, code);
          if (v2) return v2;
        }
      }
    }
  }

  return OUT_OF_SYLLABUS;
}

export function isCanonicalSubject(s: string | null | undefined): s is CanonicalSubject {
  return canonicalSubject(s) !== null;
}
