#!/usr/bin/env python3
"""
Build font-expressive-tags.json from Google Fonts official tag data.

Sources (same as Google Fonts UI / developer metadata):
  - tags/tags_metadata.csv — expressive tag paths and labels
  - tags/all/families.csv — per-family tag scores

Only families that appear in ../font-pairings.json are included to keep the
artifact small. Run from repo root or this directory:

  python3 scripts/build_font_expressive_tags.py

Requires network once to download the two CSV files.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request
from pathlib import Path

TAGS_META_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/tags/tags_metadata.csv"
)
FAMILIES_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/tags/all/families.csv"
)

ROOT = Path(__file__).resolve().parent.parent
PAIRINGS_PATH = ROOT / "font-pairings.json"
OUT_PATH = ROOT / "font-expressive-tags.json"


def fetch_text(url: str, timeout: int = 120) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "palette-switch-demo-build/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8")


def read_csv_arg(path: str | None, url: str) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8")
    return fetch_text(url)


def main() -> int:
    if not PAIRINGS_PATH.is_file():
        print(f"Missing {PAIRINGS_PATH}", file=sys.stderr)
        return 1

    argv = sys.argv[1:]
    tags_path = argv[0] if len(argv) > 0 else None
    families_path = argv[1] if len(argv) > 1 else None

    pairings = json.loads(PAIRINGS_PATH.read_text(encoding="utf-8"))
    needed: set[str] = set()
    for row in pairings.get("pairs", []):
        h = str(row.get("heading", "")).strip()
        b = str(row.get("body", "")).strip()
        if h:
            needed.add(h)
        if b:
            needed.add(b)

    try:
        meta_csv = read_csv_arg(tags_path, TAGS_META_URL)
    except Exception as exc:  # noqa: BLE001
        print(f"Could not load tags metadata: {exc}", file=sys.stderr)
        return 1
    expressive: list[dict[str, str]] = []
    reader = csv.reader(io.StringIO(meta_csv))
    for parts in reader:
        if len(parts) < 4:
            continue
        path = parts[0].strip()
        if not path.startswith("/Expressive/"):
            continue
        slug = path.rsplit("/", 1)[-1].lower()
        label = (parts[3] or slug).strip()
        if slug == "excited":
            label = "Excited"
        else:
            label = label[:1].upper() + label[1:] if label else slug.title()
        expressive.append({"id": slug, "path": path, "label": label})

    expressive.sort(key=lambda x: x["label"].lower())

    try:
        families_raw = read_csv_arg(families_path, FAMILIES_URL)
    except Exception as exc:  # noqa: BLE001
        print(f"Could not load families.csv: {exc}", file=sys.stderr)
        print(
            "Tip: download with curl then pass paths:\n"
            "  curl -o /tmp/gf-families.csv …/tags/all/families.csv\n"
            "  curl -o /tmp/gf-tags-meta.csv …/tags/tags_metadata.csv\n"
            "  python3 scripts/build_font_expressive_tags.py /tmp/gf-tags-meta.csv /tmp/gf-families.csv",
            file=sys.stderr,
        )
        return 1
    scores: dict[str, dict[str, int]] = {name: {} for name in needed}

    for line in families_raw.splitlines():
        if not line.strip():
            continue
        parts = line.split(",")
        if len(parts) < 4:
            continue
        family = parts[0].strip()
        if family not in needed:
            continue
        tag = parts[2].strip()
        if not tag.startswith("/Expressive/"):
            continue
        slug = tag.rsplit("/", 1)[-1].lower()
        try:
            weight = int(parts[3].strip())
        except ValueError:
            continue
        prev = scores[family].get(slug, 0)
        if weight > prev:
            scores[family][slug] = weight

    # Drop families with no expressive hits (keeps JSON smaller)
    families_out = {k: v for k, v in scores.items() if v}

    payload = {
        "meta": {
            "feelingsSource": TAGS_META_URL,
            "scoresSource": FAMILIES_URL,
            "matchThreshold": 20,
            "note": "Feeling ids match Google Fonts /Expressive/* tag slugs (lowercase).",
        },
        "feelings": expressive,
        "families": families_out,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({len(expressive)} feelings, {len(families_out)} families with scores).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
