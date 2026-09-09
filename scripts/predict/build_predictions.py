#!/usr/bin/env python3
"""
Question-level recurrence predictions for RBSE Class 12 Physics / Chemistry / Mathematics.

Writes src/data/predictions.json (read by src/lib/predictions.ts). Prints a backtest report.

Model (v2)
----------
Evidence   real papers (main, set-2, supplementary) and official MODEL papers (paper_type "model").
Similarity sigma = blend of char-3-5-gram TF-IDF cosine on the Latin/maths text, topic-keyword Jaccard and,
           when an embedding cache is given, Gemini text-embedding cosine (re-scaled so typical same-chapter
           pairs sit near 0). Never across chapters.
Clusters   greedy chronological leader clustering: sigma>=0.55 family ("very similar"), sigma>=0.85 exact
           group inside a family, sigma>=0.35 topic.
Score      A_f(Y) = sum_p w_p (Hit[f,p] + kappa Rel[f,p]);  w_p = 0.5^((Y-y_p)/h) * {1 main, omega supp/set2,
           omega_model model paper}.  Each paper counts once per family.
Allocation the paper structure N[c,b] (expected questions per chapter c and marks bucket b, exp.-weighted over
           recent real mains and model papers) is split over families in proportion to (A_f t_fb + alpha/F_c)^gamma
           where t_fb is the family's bucket profile, times the bucket reuse rate rho_b:
               lambda_f = s * sum_b N[c,b] rho_b share_fb        p_f = 1 - exp(-lambda_f)
           (a chapter-level variant without buckets is also fitted; a logistic stacker over both plus the topic
           layer is fitted on out-of-sample folds; the best of the three on the held-out years is exported).
Topic layer the same kernel at topic granularity without rho: chance that the *topic* is asked at all.
Backtests  mirror the real forecasting situation for {target}: the latest real paper is two years old and the
           latest model paper one year old.  Base hyper-parameters are tuned by pooled out-of-sample log-loss on
           targets 2017-{target-4}; the model-paper weight, the temperature s and the stacker are fitted on
           out-of-sample predictions; {target-3} and {target-2} are reported as hold-out.
Blueprint  the official blueprint of year {target-1} (scripts/predict/blueprints.json, from parse_blueprints.py)
           gives the chapter marks; recent papers give the range.

Usage: python scripts/predict/build_predictions.py [--db PATH] [--target-year 2027] [--embeddings PREFIX]
       [--blueprints scripts/predict/blueprints.json] [--out src/data/predictions.json]
"""
import argparse, collections, datetime, itertools, json, os, re, sqlite3, sys, unicodedata, warnings
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

TH_SIMILAR, TH_EXACT, TH_RELATED = 0.55, 0.85, 0.35
HL_STRUCT = 2.0
REAL_GAP, MODEL_GAP = 2, 1          # target 2027: real papers <= 2025, model papers <= 2026
BUCKETS = ["obj", "1", "2", "3", "4+"]
PARAM_NAMES = ["half_life", "kappa", "alpha", "omega", "gamma", "rho_half_life"]
GRID = list(itertools.product([2, 4, 8, 16, 100], [0, 0.15, 0.3, 0.6], [0.1, 0.5, 2], [0.3, 1.0], [1, 1.5, 2], [1, 2, 4]))
OMEGA_MODEL_GRID = [0, 0.5, 1, 1.5, 2, 3, 4]
TEMP_GRID = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0, 2.5, 3.0]
DEFAULT_PARAMS = (8, 0.3, 0.5, 1.0, 1.5, 2)
OFFICIAL_TOTAL = {"Physics": 56, "Chemistry": 56, "Mathematics": 80}
SUBJECT = {"physics": "Physics", "chemistry": "Chemistry", "mathematics": "Mathematics", "math": "Mathematics", "maths": "Mathematics"}
PT_ORDER = {"main": 0, "main_set2": 1, "supplementary": 2, "model": 3}
OUT = "Older / out-of-syllabus"
# Mirror of CANONICAL_CHAPTERS / KNOWN_TYPOS in src/lib/syllabus.ts (PCM only). Keep in sync.
CANON = {
    "Physics": ["Electric Charge and Fields", "Electric Potential and Capacitance", "Current Electricity", "Moving Charges and Magnetism",
                "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves",
                "Ray Optics and Optical Instruments", "Wave Optics", "Dual Nature of Radiation and Matter", "Atoms", "Nuclei", "Semiconductor Electronics"],
    "Chemistry": ["Solutions", "Electrochemistry", "Chemical Kinetics", "The D- and F-block Elements", "Coordination Compounds",
                  "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules"],
    "Mathematics": ["Relations and Functions", "Inverse Trigonometric Functions", "Matrices", "Determinants", "Continuity and Differentiability",
                    "Application of Derivatives", "Integrals", "Application of Integrals", "Differential Equations", "Vector Algebra",
                    "3D Geometry", "Linear Programming", "Probability"],
}
TYPOS = {"determinats": "Determinants", "continuityanddfferentiability": "Continuity and Differentiability"}
# Blueprint unit names that span several chapters (NCERT unit structure); split by recent history.
UNIT_GROUPS = {
    "Physics": {"electrostatics": [0, 1], "magneticeffectsofcurrentandmagnetism": [3, 4], "electromagneticinductionandalternatingcurrents": [5, 6],
                "electromagneticinductionandalternatingcurrent": [5, 6], "optics": [8, 9], "atomsandnuclei": [11, 12], "electronicdevices": [13],
                "semiconductorelectronicsmaterialsdevicesandsimplecircuits": [13], "dualnatureofmatterandradiation": [10]},
    "Chemistry": {"dandfblockelements": [3], "alcoholsphenolsandethers": [6], "aldehydesketonesandcarboxylicacids": [7]},
    "Mathematics": {"algebra": [2, 3], "calculus": [4, 5, 6, 7, 8], "vectorsandthreedimensionalgeometry": [9, 10], "vectorsand3dgeometry": [9, 10],
                    "threedimensionalgeometry": [10], "vectors": [9], "linearprogramming": [11], "inversetrigonometricfunctions": [1]},
}


def norm_key(s):
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = re.sub(r"^the\s+", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


IDX = {s: {norm_key(c): c for c in cs} for s, cs in CANON.items()}


def canonical_chapter(subject, chapter):
    if not chapter:
        return OUT
    t = re.sub(r"\s+", " ", chapter.strip())

    def look(x):
        k = norm_key(x)
        if k in IDX[subject]:
            return IDX[subject][k]
        if k in TYPOS and norm_key(TYPOS[k]) in IDX[subject]:
            return TYPOS[k]
        return None

    v = look(t)
    if v:
        return v
    if re.search(r"[,/]", t):
        for part in re.split(r"\s*[,/]\s*", t):
            v = look(part)
            if v:
                return v
    return OUT


DEVANAGARI = re.compile(r"[ऀ-ॿ]")
STOP = {"and", "the", "for", "with", "from", "law", "laws", "effect", "using", "due", "between"}


def latin_text(text):
    t = DEVANAGARI.sub(" ", text or "").lower()
    t = re.sub(r"\(\s*\)", "", t)
    t = re.sub(r"\b[a-d]\)\s*", "", t)
    t = re.sub(r"_{3,}|\.{3,}", "", t)
    return re.sub(r"\s+", " ", t).strip()


def topic_tokens(topic):
    return {w.rstrip("s") for w in re.split(r"[^a-z0-9]+", (topic or "").lower()) if len(w) >= 3 and w not in STOP}


def bucket(m, qtype=None):
    """marks bucket; objective items (MCQ / fill-in) are one bucket whatever their marks, because they were 1-mark
    before 2024 and half-mark since"""
    m = m if m is not None else 1
    if (qtype or "").lower() in ("mcq", "fill_blank", "objective", "true_false", "match") or m <= 0.5:
        return "obj"
    return "1" if m <= 1 else "2" if m <= 2 else "3" if m <= 3 else "4+"


def is_alternative(qn):
    return bool(re.search(r"\b(or|अथवा)\b", qn or "", re.I))


def load_rows(db_path):
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    rows = []
    for r in con.execute("SELECT * FROM questions WHERE year IS NOT NULL ORDER BY id"):
        r = dict(r)
        subj = SUBJECT.get((r["subject"] or "").lower())
        if not subj:
            continue
        r["S"], r["canon"] = subj, canonical_chapter(subj, r["chapter"])
        if r["canon"] == OUT:
            continue
        r["text"] = latin_text(r["question_text"])
        if len(re.findall(r"[a-z]", r["text"])) < 12:
            r["text"] = (r["question_text"] or "").lower()
        r["tt"] = topic_tokens(r["topic"])
        r["ptype"] = r["paper_type"] or "main"
        r["paper"] = (r["year"], r["ptype"])
        r["bucket"] = bucket(r["marks"], r["question_type"])
        rows.append(r)
    # "OR" alternatives: a choice between k rows is one slot -> weight so that the group sums to the number of non-OR rows
    by_paper = collections.defaultdict(list)
    for r in rows:
        by_paper[(r["S"], r["paper"])].append(r)
    for prs in by_paper.values():
        groups = collections.defaultdict(list)
        for r in prs:
            base = re.sub(r"\(.*", "", r["question_number"] or "").strip() or f"id{r['id']}"
            groups[base].append(r)
        for g in groups.values():
            n_or = sum(is_alternative(r["question_number"]) for r in g)
            w = max(len(g) - n_or, 1) / len(g) if n_or else 1.0
            for r in g:
                r["w"] = w
    return rows


def load_embeddings(prefix):
    if not prefix:
        return None
    ids_f, vec_f = prefix + "_ids.json", prefix + "_vecs.npy"
    if not (os.path.exists(ids_f) and os.path.exists(vec_f)):
        print(f"embeddings not found at {prefix}_*; continuing without")
        return None
    cache, vecs = json.load(open(ids_f)), np.load(vec_f)
    return {int(k): vecs[v["row"]] for k, v in cache.items()}


def sigma_matrix(rs, emb=None):
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)
    X = vec.fit_transform([r["text"] for r in rs])
    T = (X @ X.T).toarray()
    vocab = {}
    for r in rs:
        for t in r["tt"]:
            vocab.setdefault(t, len(vocab))
    B = np.zeros((len(rs), max(len(vocab), 1)))
    for i, r in enumerate(rs):
        for t in r["tt"]:
            B[i, vocab[t]] = 1
    inter = B @ B.T
    sz = B.sum(1)
    union = sz[:, None] + sz[None, :] - inter
    J = np.where(union > 0, inter / np.maximum(union, 1), 0)
    both = (sz > 0)[:, None] & (sz > 0)[None, :]
    S = np.where(both, 0.6 * T + 0.4 * J, T)
    ch = np.array([r["canon"] for r in rs])
    same = ch[:, None] == ch[None, :]
    coverage = 0.0
    S_rel = S
    if emb is not None:
        V = np.full((len(rs), next(iter(emb.values())).shape[0]), np.nan, dtype=np.float32)
        have = np.zeros(len(rs), bool)
        for i, r in enumerate(rs):
            if r["id"] in emb:
                V[i], have[i] = emb[r["id"]], True
        coverage = have.mean()
        if have.sum() > 10:
            E = np.where(have[:, None] & have[None, :], np.nan_to_num(V) @ np.nan_to_num(V).T, np.nan)
            off = E[same & ~np.eye(len(rs), dtype=bool) & have[:, None] & have[None, :]]
            e0 = float(np.nanpercentile(off, 60)) if off.size else 0.5
            Es = np.clip((E - e0) / max(1 - e0, 1e-6), 0, 1)
            S3 = np.where(both, 0.4 * T + 0.2 * J + 0.4 * Es, 0.55 * T + 0.45 * Es)
            S_rel = np.where(np.isnan(Es), S, S3)
    S = S * same
    S_rel = S_rel * same
    np.fill_diagonal(S, 1.0)
    np.fill_diagonal(S_rel, 1.0)
    # S: lexical similarity, decides families / exact groups (entities such as compounds and constants matter).
    # S_rel: semantic similarity, decides topics and the "related" credit.
    return S, S_rel, coverage


def leader_cluster(rs, S, th, within=None):
    n = len(rs)
    order = sorted(range(n), key=lambda i: (rs[i]["year"], PT_ORDER.get(rs[i]["ptype"], 9), rs[i]["id"]))
    cid = np.full(n, -1)
    seen = np.zeros(0, dtype=int)
    for i in order:
        cand = seen if within is None else seen[within[seen] == within[i]]
        if len(cand):
            sc = S[i, cand]
            j = int(np.argmax(sc))
            if sc[j] >= th:
                cid[i] = cid[cand[j]]
                seen = np.append(seen, i)
                continue
        cid[i] = i
        seen = np.append(seen, i)
    return cid


def relabel(cid):
    ids = sorted(set(cid))
    pos = {f: k for k, f in enumerate(ids)}
    return np.array([pos[c] for c in cid]), ids


def decay(Y, years, h):
    return 0.5 ** ((Y - years) / h)


class SubjectModel:
    def __init__(self, name, rs, emb=None):
        self.name, self.rs, self.n = name, rs, len(rs)
        self.chapters = CANON[name]
        cix = {c: i for i, c in enumerate(self.chapters)}
        self.C, self.B = len(self.chapters), len(BUCKETS)
        self.S, self.S_rel, self.emb_coverage = sigma_matrix(rs, emb)
        fam_raw = leader_cluster(rs, self.S, TH_SIMILAR)
        self.exact = leader_cluster(rs, self.S, TH_EXACT, within=fam_raw)
        self.fam, fids = relabel(fam_raw)
        self.topic, tids = relabel(leader_cluster(rs, self.S_rel, TH_RELATED))
        self.leader_id = np.array([rs[f]["id"] for f in fids])
        self.topic_leader_id = np.array([rs[t]["id"] for t in tids])
        self.F, self.T = len(fids), len(tids)
        self.members = [np.where(self.fam == k)[0] for k in range(self.F)]
        self.tmembers = [np.where(self.topic == k)[0] for k in range(self.T)]
        SigF = np.stack([self.S[m].max(axis=0) for m in self.members])
        SigR = np.stack([self.S_rel[m].max(axis=0) for m in self.members])
        self.papers = sorted({r["paper"] for r in rs}, key=lambda p: (p[0], PT_ORDER.get(p[1], 9)))
        self.P = len(self.papers)
        self.pidx = {p: np.array([i for i, r in enumerate(rs) if r["paper"] == p]) for p in self.papers}
        self.Hit = np.stack([SigF[:, self.pidx[p]].max(axis=1) >= TH_SIMILAR for p in self.papers], 1)
        self.Rel = np.stack([SigR[:, self.pidx[p]].max(axis=1) >= TH_RELATED for p in self.papers], 1) & ~self.Hit
        self.HitT = np.zeros((self.T, self.P), bool)
        for k, p in enumerate(self.papers):
            self.HitT[np.unique(self.topic[self.pidx[p]]), k] = True
        self.year = np.array([r["year"] for r in rs])
        self.w = np.array([r["w"] for r in rs])
        self.qci = np.array([cix[r["canon"]] for r in rs])
        self.qbi = np.array([BUCKETS.index(r["bucket"]) for r in rs])
        self.fci = np.array([self.qci[m[0]] for m in self.members])
        self.tci = np.array([self.qci[m[0]] for m in self.tmembers])
        self.ftopic = np.array([self.topic[m[0]] for m in self.members])
        self.pyear = np.array([p[0] for p in self.papers])
        self.ptype = np.array([p[1] for p in self.papers])
        self.pmain, self.pmodel = self.ptype == "main", self.ptype == "model"
        self.main_years = sorted(self.pyear[self.pmain].tolist())
        self.model_years = sorted(self.pyear[self.pmodel].tolist())
        # family bucket profile (weighted appearance counts per bucket)
        self.nfb = np.zeros((self.F, self.B))
        for i in range(self.n):
            self.nfb[self.fam[i], self.qbi[i]] += self.w[i]
        self.params, self.omega_model, self.temp, self.slot_aware = DEFAULT_PARAMS, 0.0, 1.0, True
        self._cache = {}

    # ---------- what is known when forecasting year Y ----------
    def hist_mask(self, Y):
        return (~self.pmodel & (self.pyear <= Y - REAL_GAP)) | (self.pmodel & (self.pyear <= Y - MODEL_GAP))

    def first_year(self, Y, H=None):
        """first appearance year of each family / topic inside the history of Y (inf when unseen)"""
        key = ("fy", Y)
        if key not in self._cache:
            m = self.hist_mask(Y)
            yrs = np.where(m, self.pyear, np.inf)
            fy = np.where(self.Hit[:, m].any(1), (np.where(self.Hit, yrs, np.inf)).min(1), np.inf)
            ty = np.where(self.HitT[:, m].any(1), (np.where(self.HitT, yrs, np.inf)).min(1), np.inf)
            self._cache[key] = (fy, ty)
        return self._cache[key]

    def structure(self, Y):
        """N[c,b]: expected questions per chapter x bucket, EW over real mains and model papers in history"""
        key = ("N", Y)
        if key not in self._cache:
            N = np.zeros((self.C, self.B))
            wsum = 0.0
            for k, p in enumerate(self.papers):
                if not self.hist_mask(Y)[k] or not (self.pmain[k] or self.pmodel[k]):
                    continue
                w = decay(Y, p[0], HL_STRUCT)
                idx = self.pidx[p]
                np.add.at(N, (self.qci[idx], self.qbi[idx]), self.w[idx] * w)
                wsum += w
            self._cache[key] = N / wsum if wsum else N
        return self._cache[key]

    def reuse(self, Y, h_rho):
        """rho_b: share of a real main paper's questions (per bucket) whose family already existed in ITS faithful
        history, exp.-weighted over real mains in the history of Y"""
        key = ("rho", Y, h_rho)
        if key not in self._cache:
            num, den = np.zeros(self.B), np.zeros(self.B)
            for k, p in enumerate(self.papers):
                if not (self.pmain[k] and self.hist_mask(Y)[k]):
                    continue
                fy, _ = self.first_year(p[0])
                idx = self.pidx[p]
                rep = fy[self.fam[idx]] < np.inf
                w = decay(Y, p[0], h_rho)
                np.add.at(num, self.qbi[idx], w * self.w[idx] * rep)
                np.add.at(den, self.qbi[idx], w * self.w[idx])
            rho_b = np.where(den > 0, num / np.maximum(den, 1e-9), num.sum() / max(den.sum(), 1e-9))
            self._cache[key] = (rho_b, num.sum() / max(den.sum(), 1e-9))
        return self._cache[key]

    def scores(self, Y, h, kappa, omega, omega_model):
        w = decay(Y, self.pyear, h) * np.where(self.pmain, 1.0, np.where(self.pmodel, omega_model, omega)) * self.hist_mask(Y)
        return (self.Hit + kappa * self.Rel) @ w, self.HitT @ w

    def predict(self, Y, params=None, omega_model=None, slot_aware=None, temp=1.0):
        h, kappa, alpha, omega, gamma, h_rho = params or self.params
        om = self.omega_model if omega_model is None else omega_model
        slot = self.slot_aware if slot_aware is None else slot_aware
        fy, _ = self.first_year(Y)
        cand = np.where(fy < np.inf)[0]
        A, _ = self.scores(Y, h, kappa, omega, om)
        A = A[cand]
        N = self.structure(Y)
        rho_b, rho = self.reuse(Y, h_rho)
        ci = self.fci[cand]
        Fc = np.bincount(ci, minlength=self.C)[ci]
        if slot:
            prof = self.nfb[cand]
            prof = (prof + 0.5 * N[ci] / np.maximum(N[ci].sum(1, keepdims=True), 1e-9)) / (prof.sum(1, keepdims=True) + 0.5)
            lam = np.zeros(len(cand))
            for b in range(self.B):
                base = (A * prof[:, b] + alpha / Fc) ** gamma
                denom = np.bincount(ci, weights=base, minlength=self.C)[ci]
                lam += N[ci, b] * rho_b[b] * base / np.maximum(denom, 1e-12)
        else:
            base = (A + alpha / Fc) ** gamma
            denom = np.bincount(ci, weights=base, minlength=self.C)[ci]
            lam = N[ci].sum(1) * rho * base / np.maximum(denom, 1e-12)
        lam = temp * lam
        return cand, 1 - np.exp(-lam), lam, A

    def predict_topic(self, Y, h, omega, omega_model, temp=1.0):
        _, ty = self.first_year(Y)
        cand = np.where(ty < np.inf)[0]
        _, AT = self.scores(Y, h, 0.0, omega, omega_model)
        AT = AT[cand]
        ci = self.tci[cand]
        Tc = np.bincount(ci, minlength=self.C)[ci]
        base = AT + 0.5 / Tc
        denom = np.bincount(ci, weights=base, minlength=self.C)[ci]
        lam = temp * self.structure(Y)[ci].sum(1) * base / np.maximum(denom, 1e-12)
        return cand, 1 - np.exp(-lam), lam

    def label(self, Y):
        return self.Hit[:, self.papers.index((Y, "main"))]

    def label_topic(self, Y):
        return self.HitT[:, self.papers.index((Y, "main"))]

    def oos(self, years, **kw):
        P, L = [], []
        for Y in years:
            cand, p, *_ = self.predict(Y, **kw)
            P.append(p)
            L.append(self.label(Y)[cand])
        return np.concatenate(P), np.concatenate(L)

    def coverage(self, Y, cand, score, K, topic=False):
        top = set(cand[np.argsort(-score)[:K]].tolist())
        idx = self.pidx[(Y, "main")]
        grp = self.topic if topic else self.fam
        return float(np.average([grp[i] in top for i in idx], weights=self.w[idx]))

    # ---------- fitting ----------
    def fit(self, target):
        years = [y for y in self.main_years if 2017 <= y <= target - REAL_GAP]
        hold = years[-2:] if len(years) >= 5 else []
        tune = [y for y in years if y not in hold]
        rep = {"tuning_years": tune, "holdout_years": hold, "embedding_coverage": round(self.emb_coverage, 3),
               "model_papers": self.model_years}
        ll = lambda p, l: float(log_loss(l, np.clip(p, 1e-4, 1 - 1e-4)))

        def fit_temp(yrs):
            """temperature s minimising log-loss over out-of-sample folds, recent folds weighted 2x per year"""
            P, L, Wt = [], [], []
            for Y in yrs:
                cand, p, *_ = self.predict(Y)
                P.append(p); L.append(self.label(Y)[cand]); Wt.append(np.full(len(cand), decay(max(yrs), Y, 1.0)))
            P, L, Wt = np.concatenate(P), np.concatenate(L), np.concatenate(Wt)
            lam = -np.log(1 - np.clip(P, 0, 1 - 1e-9))
            return min(TEMP_GRID, key=lambda s: float(log_loss(L, np.clip(1 - np.exp(-s * lam), 1e-4, 1 - 1e-4), sample_weight=Wt)))
        # 1. base params per variant (no model papers in play yet: omega_model=0)
        best = {}
        for slot in (False, True):
            scored = sorted((ll(*self.oos(tune, params=g, omega_model=0.0, slot_aware=slot)), g) for g in GRID)
            best[slot] = scored[0]
        self.slot_aware = best[True][0] <= best[False][0]
        self.params = best[self.slot_aware][1]
        rep["params_chapter"], rep["params_slot"] = list(best[False][1]), list(best[True][1])
        rep["tune_logloss_chapter"], rep["tune_logloss_slot"] = round(best[False][0], 4), round(best[True][0], 4)
        # 2. model-paper weight on the folds that have model papers in their history
        mp_years = [y for y in years if any(my <= y - MODEL_GAP for my in self.model_years)]
        if mp_years:
            sc = sorted((ll(*self.oos(mp_years, omega_model=om)), om) for om in OMEGA_MODEL_GRID)
            self.omega_model = sc[0][1]
            rep["omega_model_fit"] = {"years": mp_years, "logloss_by_omega": {str(om): round(v, 4) for v, om in sc}}
        # 3. temperature on tuning folds (honest), then evaluation, then refit on all folds
        p_t, l_t = self.oos(tune)
        temp = fit_temp(tune)
        if hold:
            p_h, l_h = self.oos(hold)
            lam_h = -np.log(1 - np.clip(p_h, 0, 1 - 1e-9))
            p_hc = 1 - np.exp(-temp * lam_h)
            alt = self.oos(hold, slot_aware=not self.slot_aware)[0]
            nomodel = self.oos(hold, omega_model=0.0)[0]
            rep.update({
                "hit_rate": round(float(l_h.mean()), 4), "auc": round(float(roc_auc_score(l_h, p_h)), 3),
                "auc_other_variant": round(float(roc_auc_score(l_h, alt)), 3), "auc_without_model_papers": round(float(roc_auc_score(l_h, nomodel)), 3),
                "logloss": round(ll(p_h, l_h), 4), "logloss_tempered": round(ll(p_hc, l_h), 4), "logloss_constant": round(ll(np.full_like(p_h, l_t.mean()), l_h), 4),
                "temperature_tune": temp, "per_year": {}, "calibration": [],
            })
            for Y in hold:
                cand, p, lam, _ = self.predict(Y, temp=temp)
                idx = self.pidx[(Y, "main")]
                fy, _ = self.first_year(Y)
                ceiling = float(np.average(fy[self.fam[idx]] < np.inf, weights=self.w[idx]))
                ct, pt, _ = self.predict_topic(Y, self.params[0], self.params[3], self.omega_model)
                lt = self.label_topic(Y)[ct]
                rep["per_year"][str(Y)] = {
                    "paper_questions": int(len(idx)), "ceiling": round(ceiling, 3), "predicted_repeats": round(float(p.sum()), 1),
                    "actual_repeated_families": int(self.label(Y)[cand].sum()),
                    **{f"top{K}": round(self.coverage(Y, cand, p, K), 3) for K in (50, 100, 200)},
                    "topic_auc": round(float(roc_auc_score(lt, pt)), 3) if 0 < lt.sum() < len(lt) else None,
                    "topic_top50": round(self.coverage(Y, ct, pt, 50, topic=True), 3), "topic_top100": round(self.coverage(Y, ct, pt, 100, topic=True), 3),
                }
            for lo, hi in [(0, .02), (.02, .05), (.05, .1), (.1, .2), (.2, .35), (.35, 1.01)]:
                m = (p_hc >= lo) & (p_hc < hi)
                if m.sum():
                    rep["calibration"].append({"range": [lo, min(hi, 1)], "n": int(m.sum()), "mean_predicted": round(float(p_hc[m].mean()), 3), "actual": round(float(l_h[m].mean()), 3)})
        # 4. stacker over out-of-sample lambdas (chapter, slot, topic) + simple features
        self.stacker = None
        Xtr, ytr = self.stack_features(tune)
        clf = LogisticRegression(C=1.0, max_iter=2000).fit(Xtr, ytr)
        if hold:
            Xh, yh = self.stack_features(hold)
            ps = clf.predict_proba(Xh)[:, 1]
            rep["stacker"] = {"auc": round(float(roc_auc_score(yh, ps)), 3), "logloss": round(ll(ps, yh), 4)}
            use_stack = rep["stacker"]["logloss"] < min(rep["logloss"], rep["logloss_tempered"]) - 0.001
        else:
            use_stack = False
        # final: temperature on all folds; stacker on all folds if it won
        self.temp = fit_temp(years)
        if use_stack:
            Xa, ya = self.stack_features(years)
            self.stacker = LogisticRegression(C=1.0, max_iter=2000).fit(Xa, ya)
        rep["final"] = {"method": "stacker" if use_stack else ("slot-aware kernel" if self.slot_aware else "chapter kernel"),
                        "temperature": self.temp, "omega_model": self.omega_model, "params": dict(zip(PARAM_NAMES, self.params))}
        return rep

    def stack_features(self, years):
        X, L = [], []
        for Y in years:
            X.append(self.features(Y))
            cand = np.where(self.first_year(Y)[0] < np.inf)[0]
            L.append(self.label(Y)[cand])
        return np.vstack(X), np.concatenate(L)

    def features(self, Y):
        cand, _, lam_s, A = self.predict(Y, slot_aware=True)
        _, _, lam_c, _ = self.predict(Y, slot_aware=False)
        ct, _, lam_t = self.predict_topic(Y, self.params[0], self.params[3], self.omega_model)
        tpos = {t: k for k, t in enumerate(ct)}
        lam_topic = np.array([lam_t[tpos[t]] if t in tpos else 0.0 for t in self.ftopic[cand]])
        m = self.hist_mask(Y)
        H = self.Hit[cand][:, m]
        gaps = Y - self.pyear[m]
        last = np.array([gaps[h].min() if h.any() else 15 for h in H])
        in_model = (self.Hit[cand] & self.pmodel[None, :] & m[None, :]).any(1)
        prof = self.nfb[cand] / np.maximum(self.nfb[cand].sum(1, keepdims=True), 1e-9)
        return np.c_[np.log(lam_s + 1e-4), np.log(lam_c + 1e-4), np.log(lam_topic + 1e-4), np.log1p(H.sum(1)), np.log1p(last), in_model, prof]

    def final_predict(self, Y):
        cand, p, lam, A = self.predict(Y, temp=self.temp)
        if self.stacker is not None:
            ps = np.clip(self.stacker.predict_proba(self.features(Y))[:, 1], 1e-6, 1 - 1e-6)
            # the stacker ranks better but is not mass-consistent when the candidate pool grows; shift its logits so
            # its total expected repeats equals the tempered kernel's
            z = np.log(ps / (1 - ps))
            lo, hi = -6.0, 6.0
            for _ in range(60):
                c = (lo + hi) / 2
                if (1 / (1 + np.exp(-(z + c)))).sum() > p.sum():
                    hi = c
                else:
                    lo = c
            p = 1 / (1 + np.exp(-(z + (lo + hi) / 2)))
        return cand, p, lam, A

    # ---------- descriptive outputs ----------
    def model_paper_report(self):
        """how much of each real main paper was already in that year's / the previous year's model paper, and how
        much of each model paper was recycled from earlier real papers"""
        out = {}
        for y in self.model_years:
            k = self.papers.index((y, "model"))
            idx = self.pidx[(y, "model")]
            earlier = ~self.pmodel & (self.pyear < y)
            recycled = float(np.average(self.Hit[self.fam[idx]][:, earlier].any(1), weights=self.w[idx]))
            row = {"model_questions": int(len(idx)), "share_recycled_from_earlier_real_papers": round(recycled, 3)}
            for lag in (0, 1):
                if (y + lag, "main") in self.pidx:
                    midx = self.pidx[(y + lag, "main")]
                    row[f"share_of_{y+lag}_main_similar_to_this_model_paper"] = round(float(np.average(self.Hit[self.fam[midx], k], weights=self.w[midx])), 3)
            out[str(y)] = row
        return out

    def chapter_forecast(self, Y, blueprint):
        N = self.structure(Y)
        m = self.hist_mask(Y) & (self.pmain | self.pmodel)
        papers = [p for k, p in enumerate(self.papers) if m[k]]
        wts = {p: decay(Y, p[0], HL_STRUCT) for p in papers}
        totals = {p: float((np.array([self.rs[i]["marks"] or 0 for i in self.pidx[p]]) * self.w[self.pidx[p]]).sum()) or 1 for p in papers}
        shares = {}
        for p in papers:
            idx = self.pidx[p]
            mk = np.array([self.rs[i]["marks"] or 0 for i in idx]) * self.w[idx]
            shares[p] = np.bincount(self.qci[idx], weights=mk, minlength=self.C) / totals[p]
        ew = sum(wts[p] * shares[p] for p in papers) / max(sum(wts.values()), 1e-9)
        official = map_blueprint(self.name, blueprint, ew) if blueprint else None
        recent = [p for p in papers if not self.pmodel[self.papers.index(p)]][-3:]
        out = {}
        for k, c in enumerate(self.chapters):
            rec = [shares[p][k] * OFFICIAL_TOTAL[self.name] for p in recent]
            types = collections.Counter()
            for p in papers[-2:]:
                for i in self.pidx[p]:
                    if self.qci[i] == k:
                        types[self.rs[i]["question_type"] or "other"] += self.w[i] / 2
            hist = round(float(ew[k] * OFFICIAL_TOTAL[self.name]), 1)
            off = official.get(c) if official else None
            out[c] = {"expected_marks": round(off, 1) if off is not None else hist, "official_marks": round(off, 1) if off is not None else None,
                      "history_marks": hist, "marks_low": round(min(rec), 1) if rec else None, "marks_high": round(max(rec), 1) if rec else None,
                      "expected_questions": round(float(N[k].sum()), 1), "families": int((self.fci == k).sum()), "topics": int((self.tci == k).sum()),
                      "type_mix": {t: round(v, 1) for t, v in types.most_common()}}
        return out

    def paper_structure(self, Y):
        m = self.hist_mask(Y) & (self.pmain | self.pmodel)
        last = [p for k, p in enumerate(self.papers) if m[k]][-1]
        cnt = collections.Counter()
        for i in self.pidx[last]:
            cnt[(self.rs[i]["question_type"] or "other", self.rs[i]["marks"] or 0)] += self.w[i]
        return {"year": last[0], "paper_type": last[1],
                "slots": [{"type": t, "marks": mk, "count": round(n, 1)} for (t, mk), n in sorted(cnt.items(), key=lambda x: (x[0][1], x[0][0]))]}


def map_blueprint(subject, bp, hist_share):
    """official blueprint units -> canonical chapter marks. Chapter-wise tables map by order; unit-wise tables are
    split over their chapters in proportion to recent history."""
    units = [u for u in (bp.get("units") or []) if u.get("marks") is not None]
    chapters = CANON[subject]
    out = {}
    if len(units) == len(chapters):
        for u, c in zip(sorted(units, key=lambda u: u.get("unit_no") or 0), chapters):
            out[c] = float(u["marks"])
        return out
    groups = UNIT_GROUPS[subject]
    for u in units:
        key = norm_key(u.get("name_english") or "")
        target = [chapters.index(IDX[subject][key])] if key in IDX[subject] else groups.get(key)
        if target is None:  # fuzzy: chapter whose normalized name shares the longest prefix
            hits = [i for i, c in enumerate(chapters) if key and (key in norm_key(c) or norm_key(c) in key)]
            target = hits or None
        if not target:
            print(f"  blueprint unit not mapped: {u.get('name_english')!r}")
            continue
        hs = np.array([hist_share[i] for i in target])
        hs = hs / hs.sum() if hs.sum() > 0 else np.full(len(target), 1 / len(target))
        for i, s in zip(target, hs):
            out[chapters[i]] = out.get(chapters[i], 0.0) + float(u["marks"]) * float(s)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db")
    ap.add_argument("--out", default=os.path.join(ROOT, "src", "data", "predictions.json"))
    ap.add_argument("--target-year", type=int)
    ap.add_argument("--embeddings", help="prefix of <prefix>_ids.json / <prefix>_vecs.npy from embed_questions.py")
    ap.add_argument("--blueprints", default=os.path.join(HERE, "blueprints.json"))
    args = ap.parse_args()
    db = args.db
    if not db:
        for cand in [os.path.join(ROOT, "..", "questions.db"), os.path.join(ROOT, "..", "rbse-qbank", "questions.db")]:
            if os.path.exists(cand):
                db = cand
                break
    if not db or not os.path.exists(db):
        sys.exit("questions.db not found; pass --db")
    rows = load_rows(db)
    emb = load_embeddings(args.embeddings)
    blueprints = json.load(open(args.blueprints)) if os.path.exists(args.blueprints) else {}
    by_s = collections.defaultdict(list)
    for r in rows:
        by_s[r["S"]].append(r)
    latest_real = max(r["year"] for r in rows if r["ptype"] != "model")
    target = args.target_year or latest_real + REAL_GAP
    print(f"source {os.path.relpath(db)}  rows={len(rows)} (model-paper rows {sum(r['ptype']=='model' for r in rows)})  target main paper: {target}  "
          f"embeddings: {'yes' if emb else 'no'}  blueprints: {sorted(blueprints)}")
    out = {"generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "source_db": os.path.relpath(db, ROOT),
           "target_year": target, "thresholds": {"similar": TH_SIMILAR, "exact": TH_EXACT, "related": TH_RELATED},
           "subjects": {}, "families": {}, "topics": {}, "questions": {}}
    for name in ["Physics", "Chemistry", "Mathematics"]:
        M = SubjectModel(name, by_s[name], emb)
        rep = M.fit(target)
        cand, p, lam, A = M.final_predict(target)
        ct, pt, _ = M.predict_topic(target, M.params[0], M.params[3], M.omega_model, temp=1.0)
        bp = blueprints.get(f"{name.lower()}_{target-1}") or blueprints.get(f"{name.lower()}_{target-2}")
        chapters = M.chapter_forecast(target, bp)
        rho_b, rho = M.reuse(target, M.params[5])
        ex_hits = tot_hits = 0
        for pp in [q for q in M.papers if q[1] == "main"][-3:]:
            fy, _ = M.first_year(pp[0])
            for i in M.pidx[pp]:
                if fy[M.fam[i]] < np.inf:
                    tot_hits += 1
                    ex_hits += any(M.exact[j] == M.exact[i] and M.year[j] < pp[0] for j in M.members[M.fam[i]])
        exact_share = (ex_hits + 1) / (tot_hits + 4)
        print(f"-- {name}: n={M.n} families={M.F} topics={M.T} emb_cov={M.emb_coverage:.0%} final={rep['final']} reuse={rho:.2f}")
        if "auc" in rep:
            print(f"   holdout {rep['holdout_years']}: AUC={rep['auc']} (other variant {rep['auc_other_variant']}, no model papers {rep['auc_without_model_papers']}) "
                  f"logloss={rep['logloss']} tempered={rep['logloss_tempered']} const={rep['logloss_constant']} stacker={rep.get('stacker')}")
            for y, v in rep["per_year"].items():
                print(f"     {y}: paper={v['paper_questions']}q ceiling={v['ceiling']:.0%} pred_repeats={v['predicted_repeats']} actual={v['actual_repeated_families']} "
                      f"top50/100/200={v['top50']:.0%}/{v['top100']:.0%}/{v['top200']:.0%} | topic AUC={v['topic_auc']} topic top50/100={v['topic_top50']:.0%}/{v['topic_top100']:.0%}")
            print("     calib: " + " ".join(f"[{b['range'][0]:.2f}-{b['range'][1]:.2f}) n={b['n']} p={b['mean_predicted']:.3f} a={b['actual']:.3f}" for b in rep["calibration"]))
        if "omega_model_fit" in rep:
            print(f"   omega_model: {rep['omega_model_fit']['logloss_by_omega']}")
        mpr = M.model_paper_report()
        if mpr:
            print("   model papers: " + json.dumps(mpr, separators=(",", ":"))[:600])
        print(f"   {target}: sum(p)={p.sum():.1f} median={np.median(p):.3f} p90={np.percentile(p, 90):.3f} max={p.max():.2f}")
        for k in np.argsort(-p)[:3]:
            m = M.members[cand[k]]
            r = M.rs[m[np.argmax(M.year[m])]]
            print(f"     {p[k]:.2f} [{r['canon'][:24]} {r['marks']}m] {sorted({(int(M.year[i]), M.rs[i]['ptype'][:2]) for i in m})} :: {r['text'][:60]}")
        out["subjects"][name] = {"official_total_marks": OFFICIAL_TOTAL[name], "reuse_rate": round(float(rho), 3), "reuse_by_bucket": dict(zip(BUCKETS, [round(float(x), 3) for x in rho_b])),
                                 "exact_share": round(exact_share, 3), "families": M.F, "topics": M.T, "questions": M.n, "eval": rep, "model_papers": mpr,
                                 "paper_structure": M.paper_structure(target), "blueprint_year": (target - 1) if bp else None, "chapters": chapters}
        tp = {int(ct[k]): float(pt[k]) for k in range(len(ct))}
        for t in range(M.T):
            m = M.tmembers[t]
            out["topics"][f"{name[0]}T{M.topic_leader_id[t]}"] = {"subject": name, "chapter": M.chapters[M.tci[t]], "p": round(tp.get(t, 0.0), 4),
                                                                   "families": int(len(set(M.fam[m]))), "years": sorted({int(y) for y in M.year[m]})}
        pmap = {int(cand[k]): (float(p[k]), float(A[k])) for k in range(len(cand))}
        for f in range(M.F):
            m = M.members[f]
            fid = f"{name[0]}{M.leader_id[f]}"
            pf, af = pmap.get(f, (0.0, 0.0))
            tid = f"{name[0]}T{M.topic_leader_id[M.ftopic[f]]}"
            n_f = len({M.rs[i]["paper"] for i in m})
            out["families"][fid] = {"subject": name, "chapter": M.chapters[M.fci[f]], "p": round(pf, 4), "score": round(af, 2), "topic": tid,
                                    "related_papers": int(M.Rel[f].sum()),
                                    "appearances": [[int(M.rs[i]["year"]), M.rs[i]["ptype"], M.rs[i]["marks"], int(M.rs[i]["id"])] for i in sorted(m, key=lambda i: (M.year[i], M.rs[i]["id"]))]}
            for i in m:
                n_x = len({M.rs[j]["paper"] for j in m if M.exact[j] == M.exact[i]})
                out["questions"][str(int(M.rs[i]["id"]))] = {"fid": fid, "tid": tid, "p": round(pf, 4), "px": round(pf * (n_x + 2 * exact_share) / (n_f + 2), 4),
                                                             "pt": round(tp.get(int(M.ftopic[f]), 0.0), 4)}
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    json.dump(out, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {os.path.relpath(args.out)} ({os.path.getsize(args.out)//1024} KB, {len(out['questions'])} questions, {len(out['families'])} families, {len(out['topics'])} topics)")


if __name__ == "__main__":
    main()
