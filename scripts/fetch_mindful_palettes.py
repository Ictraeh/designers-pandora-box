#!/usr/bin/env python3
"""
Collect #MindfulPalettes posts from Alex Cristache's Bluesky feed (public xrpc).
Mirrors the same source nopzon.com aggregates; nopzon's /more GET currently
serves HTML for a literal tag "MindfulPalettes/more", so pagination uses Bluesky.

Output: docs/mindful-palettes.json
"""
from __future__ import annotations

import json
import os
import re
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ACTOR = "alexcristache.bsky.social"
API = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed"
MAX_PAGES = 80
LIMIT = 100

HEX = re.compile(r"#([0-9A-Fa-f]{6})\b")
NUM_SERIES = re.compile(
    r"Mindful\s+Palettes\s+Series\s*(?:\u2116|#)?\s*(\d+)",
    re.I,
)
NUM_HASH = re.compile(r"#MindfulPalettes\s+no\.?\s*(\d+)", re.I)
NUM_WORD = re.compile(r"MindfulPalettes\s+no\.?\s*(\d+)", re.I)


def fetch_page(cursor: str | None) -> dict:
    q = {"actor": ACTOR, "limit": str(LIMIT)}
    if cursor:
        q["cursor"] = cursor
    url = API + "?" + urllib.parse.urlencode(q)
    # Prefer curl (system CA bundle); urllib may fail in some environments.
    if os.environ.get("MINDFUL_USE_URLLIB"):
        ctx = ssl.create_default_context()
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; MindfulPalettesExport/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
            return json.loads(r.read().decode("utf-8"))
    out = subprocess.check_output(
        ["/usr/bin/curl", "-fsSL", url],
        text=True,
        timeout=120,
    )
    return json.loads(out)


def palette_number(text: str) -> int | None:
    for rx in (NUM_SERIES, NUM_HASH, NUM_WORD):
        m = rx.search(text)
        if m:
            return int(m.group(1))
    return None


def gather_text_and_alts(record: dict) -> str:
    """Bluesky often puts the hex list in the first image's alt text, not the post body."""
    parts: list[str] = []
    t = record.get("text") or ""
    if t:
        parts.append(t)
    emb = record.get("embed") or {}
    et = emb.get("$type") or ""

    def add_image_alts(images: list | None) -> None:
        for im in images or []:
            alt = im.get("alt") or ""
            if alt:
                parts.append(alt)

    if et == "app.bsky.embed.images":
        add_image_alts(emb.get("images"))
    elif et == "app.bsky.embed.recordWithMedia":
        media = emb.get("media") or {}
        if media.get("$type") == "app.bsky.embed.images":
            add_image_alts(media.get("images"))
    return "\n".join(parts)


def extract_summary(text: str) -> str:
    t = text.replace("\r", " ").strip()
    if "🆕" in t:
        part = t.split("🆕", 1)[-1].strip()
    elif "New color palette" in t:
        part = t.split("New color palette", 1)[-1].strip()
        if part.startswith("–"):
            part = part[1:].strip()
    else:
        part = t
    part = re.sub(r"\s+", " ", part)
    part = re.sub(r"🔖.*$", "", part).strip()
    return part[:500] if part else ""


def hexes_from_color_codes_line(blob: str) -> list[str]:
    """Prefer the segment after 'color codes' through end of paragraph."""
    low = blob.lower()
    key = "color codes"
    i = low.find(key)
    if i == -1:
        return []
    chunk = blob[i:]
    found = HEX.findall(chunk)
    if "\n\n" in chunk:
        chunk2 = chunk.split("\n\n", 1)[0]
        found = HEX.findall(chunk2)
    return [f"#{h.upper()}" for h in found]


def normalize_hex_list(raw: list[str], palette_no: int | None) -> list[str] | None:
    """Expect 6 #RRGGBB strings; fix known mirror typo on palette 261 (#F5C73 -> #F56C73)."""
    if len(raw) != 6:
        return None
    fixed: list[str] = []
    for h in raw:
        h = h.strip()
        if re.fullmatch(r"#[0-9A-Fa-f]{6}", h):
            fixed.append("#" + h[1:].upper())
        elif re.fullmatch(r"#[0-9A-Fa-f]{5}", h) and palette_no == 261:
            fixed.append("#F56C73")
        else:
            return None
    return fixed


def main() -> int:
    cursor: str | None = None
    # palette_no -> { hexes, summary, uri, text_snippet }
    best: dict[int, dict] = {}

    for page in range(MAX_PAGES):
        data = fetch_page(cursor)
        feed = data.get("feed") or []
        if not feed:
            break
        for item in feed:
            post = item.get("post") or {}
            uri = post.get("uri") or ""
            record = post.get("record") or {}
            blob = gather_text_and_alts(record)
            if "#MindfulPalettes" not in blob and "MindfulPalettes" not in blob:
                continue
            if "color codes" not in blob.lower() and "colour codes" not in blob.lower():
                continue
            pno = palette_number(blob)
            if pno is None:
                continue
            raw_hex = hexes_from_color_codes_line(blob)
            if len(raw_hex) < 6:
                continue
            raw_hex = raw_hex[:6]
            colors = normalize_hex_list(raw_hex, pno)
            if not colors:
                continue
            summary = extract_summary(record.get("text") or "")
            if not summary.strip():
                summary = extract_summary(blob)
            prev = best.get(pno)
            if prev is None or len(prev.get("summary", "")) < len(summary):
                best[pno] = {
                    "paletteNumber": pno,
                    "paletteSummary": summary,
                    "colors": [{"slot": i + 1, "hex": h} for i, h in enumerate(colors)],
                    "sourceUri": uri,
                    "indexedAt": post.get("indexedAt"),
                }
        cursor = data.get("cursor")
        if not cursor:
            break

    palettes = sorted(best.values(), key=lambda x: x["paletteNumber"])
    out = {
        "meta": {
            "actor": ACTOR,
            "api": "Bluesky public AppView `app.bsky.feed.getAuthorFeed` (same #MindfulPalettes posts aggregated on nopzon.com/tag/MindfulPalettes)",
            "paletteCount": len(palettes),
            "note": "nopzon's in-page `Load more` calls GET /tag/MindfulPalettes/more?cursor=…; that path is currently routed as a literal hashtag page (HTML), not JSON. This export paginates the author's Bluesky feed instead and reads hex lists from image alt text when present. Per-slot color names are not in the source; `paletteSummary` is derived from the post caption.",
        },
        "palettes": palettes,
    }
    path = ROOT / "docs" / "mindful-palettes.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(palettes)} palettes to {path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
