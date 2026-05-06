#!/usr/bin/env python3
"""
Score Mindful Palettes (or any hex list export) against a mood / adjective query.

Loads:
  - mood-to-color-framework.json
  - mood-to-color-lexicon.json
  - optional ../Mood to Motion Map/mood-to-motion-map.json (adds cluster adjectives → priors)
  - mindful-palettes.json (path from --palettes or env MINDFUL_PALETTES_JSON)

Example:
  python3 match_palettes.py "trustworthy fintech calm" --top 8
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent

DEFAULT_MINDFUL = Path.home() / (
    "Desktop/Design Style Layout Markdown Library/Color system /Mindful Palletes/mindful-palettes.json"
)

AXIS_KEYS = ("warmCool", "arousal", "valence", "sophistication", "grounding", "openness")

DEFAULT_CLUSTER_COLOR_PRIORS: dict[str, dict[str, Any]] = {
    "calm_natural": {"hueDeg": 105, "hueSigmaDeg": 75, "axes": {"warmCool": 0.05, "arousal": 0.22, "valence": 0.35, "sophistication": 0.45, "grounding": 0.62, "openness": 0.55}},
    "elegant_luxe": {"hueDeg": 35, "hueSigmaDeg": 85, "axes": {"warmCool": 0.15, "arousal": 0.25, "valence": 0.25, "sophistication": 0.85, "grounding": 0.2, "openness": 0.35}},
    "snappy_confident": {"hueDeg": 12, "hueSigmaDeg": 55, "axes": {"warmCool": 0.35, "arousal": 0.82, "valence": 0.45, "sophistication": 0.4, "grounding": 0.15, "openness": 0.55}},
    "playful_bouncy": {"hueDeg": 300, "hueSigmaDeg": 90, "axes": {"warmCool": 0.1, "arousal": 0.75, "valence": 0.7, "sophistication": 0.25, "grounding": 0.2, "openness": 0.75}},
    "cinematic_bold": {"hueDeg": 265, "hueSigmaDeg": 70, "axes": {"warmCool": -0.35, "arousal": 0.55, "valence": -0.15, "sophistication": 0.55, "grounding": 0.25, "openness": 0.25}},
    "technical_dense": {"hueDeg": 205, "hueSigmaDeg": 50, "axes": {"warmCool": -0.45, "arousal": 0.35, "valence": 0.1, "sophistication": 0.68, "grounding": 0.12, "openness": 0.42}},
    "ambient_atmosphere": {"hueDeg": 195, "hueSigmaDeg": 65, "axes": {"warmCool": -0.2, "arousal": 0.18, "valence": 0.3, "sophistication": 0.55, "grounding": 0.1, "openness": 0.7}},
    "story_narrative": {"hueDeg": 40, "hueSigmaDeg": 100, "axes": {"warmCool": 0.2, "arousal": 0.4, "valence": 0.35, "sophistication": 0.45, "grounding": 0.35, "openness": 0.5}},
    "dark_noir": {"hueDeg": 265, "hueSigmaDeg": 45, "axes": {"warmCool": -0.4, "arousal": 0.35, "valence": -0.25, "sophistication": 0.55, "grounding": 0.15, "openness": 0.15}},
    "retro_digital": {"hueDeg": 28, "hueSigmaDeg": 95, "axes": {"warmCool": 0.15, "arousal": 0.45, "valence": 0.25, "sophistication": 0.35, "grounding": 0.35, "openness": 0.45}},
    "luxury_jewelry": {"hueDeg": 285, "hueSigmaDeg": 60, "axes": {"warmCool": -0.1, "arousal": 0.32, "valence": 0.2, "sophistication": 0.9, "grounding": 0.15, "openness": 0.25}},
    "wellness_spa": {"hueDeg": 170, "hueSigmaDeg": 70, "axes": {"warmCool": -0.12, "arousal": 0.2, "valence": 0.45, "sophistication": 0.78, "grounding": 0.35, "openness": 0.5}},
    "startup_saas": {"hueDeg": 215, "hueSigmaDeg": 55, "axes": {"warmCool": -0.35, "arousal": 0.38, "valence": 0.25, "sophistication": 0.55, "grounding": 0.08, "openness": 0.55}},
    "fashion_runway": {"hueDeg": 320, "hueSigmaDeg": 85, "axes": {"warmCool": 0.05, "arousal": 0.55, "valence": 0.45, "sophistication": 0.65, "grounding": 0.12, "openness": 0.55}},
    "food_warmth": {"hueDeg": 25, "hueSigmaDeg": 60, "axes": {"warmCool": 0.55, "arousal": 0.42, "valence": 0.35, "sophistication": 0.22, "grounding": 0.45, "openness": 0.55}},
    "finance_trust": {"hueDeg": 218, "hueSigmaDeg": 45, "axes": {"warmCool": -0.55, "arousal": 0.28, "valence": 0.15, "sophistication": 0.68, "grounding": 0.1, "openness": 0.35}},
    "education_friendly": {"hueDeg": 200, "hueSigmaDeg": 90, "axes": {"warmCool": -0.15, "arousal": 0.35, "valence": 0.55, "sophistication": 0.35, "grounding": 0.22, "openness": 0.78}},
    "music_club": {"hueDeg": 305, "hueSigmaDeg": 70, "axes": {"warmCool": -0.05, "arousal": 0.88, "valence": 0.55, "sophistication": 0.22, "grounding": 0.08, "openness": 0.72}},
    "travel_wanderlust": {"hueDeg": 200, "hueSigmaDeg": 85, "axes": {"warmCool": -0.12, "arousal": 0.45, "valence": 0.55, "sophistication": 0.35, "grounding": 0.35, "openness": 0.72}},
    "social_proof": {"hueDeg": 145, "hueSigmaDeg": 80, "axes": {"warmCool": 0.05, "arousal": 0.35, "valence": 0.45, "sophistication": 0.4, "grounding": 0.22, "openness": 0.65}},
    "minimal_brutal": {"hueDeg": 0, "hueSigmaDeg": 30, "axes": {"warmCool": 0.0, "arousal": 0.18, "valence": 0.0, "sophistication": 0.55, "grounding": 0.12, "openness": 0.35}},
    "wedding_romantic": {"hueDeg": 345, "hueSigmaDeg": 65, "axes": {"warmCool": 0.12, "arousal": 0.28, "valence": 0.65, "sophistication": 0.62, "grounding": 0.12, "openness": 0.55}},
    "real_estate_drone": {"hueDeg": 210, "hueSigmaDeg": 75, "axes": {"warmCool": -0.25, "arousal": 0.35, "valence": 0.18, "sophistication": 0.48, "grounding": 0.35, "openness": 0.45}},
    "nonprofit_hope": {"hueDeg": 130, "hueSigmaDeg": 85, "axes": {"warmCool": 0.05, "arousal": 0.32, "valence": 0.55, "sophistication": 0.35, "grounding": 0.4, "openness": 0.72}},
    "gaming_hud": {"hueDeg": 195, "hueSigmaDeg": 55, "axes": {"warmCool": -0.25, "arousal": 0.85, "valence": 0.35, "sophistication": 0.35, "grounding": 0.05, "openness": 0.55}},
    "medical_clinical": {"hueDeg": 195, "hueSigmaDeg": 40, "axes": {"warmCool": -0.55, "arousal": 0.18, "valence": 0.18, "sophistication": 0.65, "grounding": 0.05, "openness": 0.45}},
    "sustainability_earth": {"hueDeg": 115, "hueSigmaDeg": 75, "axes": {"warmCool": -0.05, "arousal": 0.28, "valence": 0.4, "sophistication": 0.4, "grounding": 0.88, "openness": 0.55}},
    "festival_poster": {"hueDeg": 300, "hueSigmaDeg": 100, "axes": {"warmCool": 0.1, "arousal": 0.88, "valence": 0.85, "sophistication": 0.18, "grounding": 0.15, "openness": 0.85}},
    "museum_archive": {"hueDeg": 35, "hueSigmaDeg": 70, "axes": {"warmCool": 0.08, "arousal": 0.22, "valence": 0.12, "sophistication": 0.72, "grounding": 0.35, "openness": 0.28}},
    "sale_urgency": {"hueDeg": 8, "hueSigmaDeg": 45, "axes": {"warmCool": 0.55, "arousal": 0.9, "valence": 0.35, "sophistication": 0.12, "grounding": 0.1, "openness": 0.65}},
    "ai_productivity": {"hueDeg": 265, "hueSigmaDeg": 60, "axes": {"warmCool": -0.18, "arousal": 0.48, "valence": 0.25, "sophistication": 0.58, "grounding": 0.05, "openness": 0.55}},
}


def hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.strip().lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))


def rgb_to_hsl(r: float, g: float, b: float) -> tuple[float, float, float]:
    mx = max(r, g, b)
    mn = min(r, g, b)
    l = (mx + mn) / 2.0
    d = mx - mn
    if d < 1e-9:
        return 0.0, 0.0, l
    s = d / (2.0 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r:
        h = ((g - b) / d + (6.0 if g < b else 0.0)) % 6.0
    elif mx == g:
        h = (b - r) / d + 2.0
    else:
        h = (r - g) / d + 4.0
    return h * 60.0, s, l


def circular_mean_hues(degrees: list[float]) -> float:
    sx = sum(math.cos(math.radians(h)) for h in degrees)
    sy = sum(math.sin(math.radians(h)) for h in degrees)
    return math.degrees(math.atan2(sy, sx)) % 360.0


def dominant_hue_cluster_indices(hs: list[float]) -> list[int]:
    """
    Split 6 hues into two plane clusters; return indices of the larger group.
    So one accent (e.g. lone green among reds) does not define palette hue mood.
    Tie 3–3 → use all indices.
    """
    n = len(hs)
    if n < 4:
        return list(range(n))
    pts = [(math.cos(math.radians(h)), math.sin(math.radians(h))) for h in hs]
    best_j = 1
    best_d = -1.0
    for j in range(1, n):
        d = hue_delta(hs[0], hs[j])
        if d > best_d:
            best_d = d
            best_j = j
    c1 = [pts[0][0], pts[0][1]]
    c2 = [pts[best_j][0], pts[best_j][1]]
    g1: list[int] = []
    g2: list[int] = []
    for _ in range(8):
        g1, g2 = [], []
        for i, p in enumerate(pts):
            d1 = (p[0] - c1[0]) ** 2 + (p[1] - c1[1]) ** 2
            d2 = (p[0] - c2[0]) ** 2 + (p[1] - c2[1]) ** 2
            (g1 if d1 <= d2 else g2).append(i)
        if not g1 or not g2:
            return list(range(n))

        def mean_xy(ixs: list[int]) -> list[float]:
            sx = sum(pts[i][0] for i in ixs) / len(ixs)
            sy = sum(pts[i][1] for i in ixs) / len(ixs)
            return [sx, sy]

        c1, c2 = mean_xy(g1), mean_xy(g2)
    if len(g1) == len(g2):
        return list(range(n))
    return g1 if len(g1) > len(g2) else g2


def hue_delta(a: float, b: float) -> float:
    d = abs(a - b) % 360.0
    return min(d, 360.0 - d)


def gaussian_hue_kernel(query_h: float, palette_h: float, sigma: float) -> float:
    d = hue_delta(query_h, palette_h)
    return math.exp(-0.5 * (d / max(sigma, 1e-6)) ** 2)


def palette_profile(hexes: list[str]) -> dict[str, float]:
    """
    Whole-palette semantics: arousal/contrast use all swatches; hue story (mean hue,
    warm/cool, grounding) uses the dominant hue cluster so a single accent does not
    hijack mood (e.g. five reds + one green).
    """
    hsls = [rgb_to_hsl(*hex_to_rgb(h)) for h in hexes]
    hs = [h for h, s, _l in hsls]
    ss = [s for h, s, _l in hsls]
    ls = [_l for h, s, _l in hsls]
    dom_idx = dominant_hue_cluster_indices(hs)
    dom_hs = [hs[i] for i in dom_idx]

    mean_h = circular_mean_hues(dom_hs)
    warm_cool = sum(math.cos(math.radians(h)) for h in dom_hs) / len(dom_hs)

    mean_s = sum(ss) / len(ss)
    mean_l = sum(ls) / len(ls)
    spread_l = max(ls) - min(ls)
    arousal = min(1.0, 0.55 * mean_s + 0.45 * min(1.0, spread_l * 1.8))
    valence = max(-1.0, min(1.0, (mean_l - 0.45) * 2.2 + (mean_s - 0.35) * 0.8))
    sophistication = max(0.0, min(1.0, 1.0 - mean_s * 0.85 + (0.25 - abs(mean_l - 0.55)) * 0.4))
    grounding = 0.0
    for i in dom_idx:
        h, s, l = hsls[i]
        if 70 <= h % 360 <= 150 and s < 0.55:
            grounding += 0.2
        if 20 <= h % 360 <= 70 and l < 0.55:
            grounding += 0.12
    grounding = min(1.0, grounding)
    openness = max(0.0, min(1.0, 0.55 * mean_l + 0.35 * (1.0 - mean_s * 0.6)))
    dom_samples = [
        {"h": float(hs[i] % 360.0), "s": float(ss[i]), "l": float(ls[i])}
        for i in dom_idx
    ]
    return {
        "hueDeg": mean_h,
        "warmCool": warm_cool,
        "arousal": arousal,
        "valence": valence,
        "sophistication": sophistication,
        "grounding": grounding,
        "openness": openness,
        "meanS": mean_s,
        "meanL": mean_l,
        "domSamples": dom_samples,
    }


def axis_sim(q: float, p: float, key: str) -> float:
    if key == "warmCool":
        return 1.0 - min(1.0, abs(q - p) / 2.0)
    return 1.0 - min(1.0, abs(q - p))


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def tokenize(q: str) -> list[str]:
    return [t for t in re.split(r"[^a-zA-Z0-9]+", q.lower()) if len(t) > 1]


def build_lexicon_index(
    lexicon: dict[str, Any], motion_path: Path | None
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = list(lexicon.get("entries") or [])
    if motion_path and motion_path.is_file():
        motion = load_json(motion_path)
        for cl in motion.get("moodClusters") or []:
            cid = cl.get("id")
            if not cid or cid not in DEFAULT_CLUSTER_COLOR_PRIORS:
                continue
            prior = DEFAULT_CLUSTER_COLOR_PRIORS[cid]
            for adj in cl.get("adjectives") or []:
                entries.append(
                    {
                        "lemmas": [adj.lower()],
                        "hueDeg": prior["hueDeg"],
                        "hueSigmaDeg": prior["hueSigmaDeg"],
                        "axes": dict(prior["axes"]),
                        "refs": [f"motionCluster:{cid}"],
                    }
                )
    return entries


def score_palette(
    query: str,
    profile: dict[str, float],
    summary: str,
    entries: list[dict[str, Any]],
    weights: dict[str, float],
) -> float:
    toks = set(tokenize(query))
    summary_l = summary.lower()
    matched: list[dict[str, Any]] = []
    for e in entries:
        lemmas = [x.lower() for x in e.get("lemmas") or []]
        if any(lem in toks for lem in lemmas):
            matched.append(e)
    if not matched:
        for e in entries:
            lemmas = [x.lower() for x in e.get("lemmas") or []]
            if any(lem in query.lower() for lem in lemmas):
                matched.append(e)
    if not matched:
        return 0.0

    hue_k = 0.0
    axis_acc = 0.0
    axis_n = 0
    for e in matched:
        qh = float(e["hueDeg"])
        sig = float(e["hueSigmaDeg"])
        hue_k += gaussian_hue_kernel(qh, profile["hueDeg"], sig)
        ax = e.get("axes") or {}
        for k in AXIS_KEYS:
            if k in ax and k in profile:
                axis_acc += axis_sim(float(ax[k]), float(profile[k]), k)
                axis_n += 1
    hue_k /= max(len(matched), 1)
    axis_part = axis_acc / max(axis_n, 1)

    text_boost = 0.0
    for t in toks:
        if t in summary_l:
            text_boost += 0.08
    text_boost = min(0.24, text_boost)

    w = weights
    return w.get("hueKernel", 0.42) * hue_k + w.get("axes", 0.38) * axis_part + w.get("textBoost", 0.2) * text_boost


def main() -> int:
    ap = argparse.ArgumentParser(description="Rank palettes for a mood / adjective query.")
    ap.add_argument("query", help="Space-separated mood words, e.g. 'calm organic trust'")
    ap.add_argument("--top", type=int, default=10, help="Number of results")
    ap.add_argument(
        "--palettes",
        type=Path,
        default=Path(os.environ.get("MINDFUL_PALETTES_JSON", str(DEFAULT_MINDFUL))),
        help="Path to mindful-palettes.json",
    )
    ap.add_argument(
        "--no-motion",
        action="store_true",
        help="Do not augment lexicon from Mood to Motion Map clusters",
    )
    args = ap.parse_args()

    fw = load_json(HERE / "mood-to-color-framework.json")
    lex = load_json(HERE / "mood-to-color-lexicon.json")
    motion_path = None if args.no_motion else HERE.parent / "Mood to Motion Map" / "mood-to-motion-map.json"
    entries = build_lexicon_index(lex, motion_path)

    if not args.palettes.is_file():
        print(f"Missing palettes JSON: {args.palettes}", file=sys.stderr)
        print("Set MINDFUL_PALETTES_JSON or pass --palettes", file=sys.stderr)
        return 1

    pal_data = load_json(args.palettes)
    palettes = pal_data.get("palettes") or []
    w = (fw.get("matchingRules") or {}).get("weightsDefault") or {}

    ranked: list[tuple[float, dict[str, Any]]] = []
    for p in palettes:
        hexes = [c["hex"] for c in p.get("colors") or [] if c.get("hex")]
        if len(hexes) < 6:
            continue
        prof = palette_profile(hexes)
        s = score_palette(args.query, prof, p.get("paletteSummary") or "", entries, w)
        ranked.append((s, p))
    ranked.sort(key=lambda x: x[0], reverse=True)

    out = []
    for s, p in ranked[: args.top]:
        out.append(
            {
                "score": round(s, 4),
                "paletteNumber": p.get("paletteNumber"),
                "summary": (p.get("paletteSummary") or "")[:220],
                "hexes": [c["hex"] for c in p.get("colors") or []],
            }
        )
    print(json.dumps({"query": args.query, "results": out}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
