# Palette switch demo (Mood to Color + guidelines)

This page is a **sample marketing site** whose entire color system is driven by **Mood to Color** data and the same **OKLab role pipeline** as `Mood to Color/website-theme-demo` (semantic roles, contrast-aware text, surfaces, focus, tags—not naive hex swaps). See `../AI_PALETTE_SWITCH_GUIDELINES.md` for the design rules the pipeline implements.

## Run locally

The browser loads:

- `../../Mood to Color/demo/data/mindful-palettes.json` (and optional Pinterest JSON)
- scripts from `../../Mood to Color/website-theme-demo/`

So the HTTP server **document root** must be the folder that contains **both** `Mood to Color` and `Color Palette Switch Guidelines` (your **Designer's pandora box** directory).

```bash
cd "/Users/wenjiacreatie/Desktop/Designer's pandora box"
python3 -m http.server 9898
```

If the port is busy, use another (e.g. `9899`) and adjust the URL below.

Then open:

`http://127.0.0.1:9898/Color%20Palette%20Switch%20Guidelines/palette-switch-demo/index.html`

If Pinterest data is missing, the demo still runs on Mindful Palettes only.

## Typography (Google Fonts “Feeling” filter)

Font pairings load from `font-pairings.json`. The **Feeling** control filters pairings using **Google Fonts official expressive tags** (`/Expressive/*` paths from the [`google/fonts`](https://github.com/google/fonts) `tags/tags_metadata.csv` and per-family scores from `tags/all/families.csv`). A pairing appears under a feeling when **either** the heading or body family has that tag score above the threshold in `font-expressive-tags.json` (default **20**). **All feelings** shows the full list.

### Regenerate `font-expressive-tags.json`

After you change `font-pairings.json`, rebuild the tag file (small download of the official CSVs). On some systems Python’s HTTPS fails; using `curl` first avoids that:

```bash
cd "/path/to/Designer's pandora box/Color Palette Switch Guidelines/palette-switch-demo"
curl -sS -o /tmp/gf-families.csv "https://raw.githubusercontent.com/google/fonts/main/tags/all/families.csv"
curl -sS -o /tmp/gf-tags-meta.csv "https://raw.githubusercontent.com/google/fonts/main/tags/tags_metadata.csv"
python3 scripts/build_font_expressive_tags.py /tmp/gf-tags-meta.csv /tmp/gf-families.csv
```

## Use

1. Choose a **mood** chip (and optional extra words).
2. Set **light/dark** and **tone** (clear, neon, soft, …).
3. Click **Find palettes** — palettes are ranked with `mood-engine-v2` and filtered like the theme demo.
4. Click **Apply** on a palette card — that palette’s six swatches become the candidate pool for `buildMoodWebsiteTheme` (roles + generated tokens + CSS variables).
