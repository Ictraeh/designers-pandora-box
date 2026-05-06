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

## Use

1. Choose a **mood** chip (and optional extra words).
2. Set **light/dark** and **tone** (clear, neon, soft, …).
3. Click **Find palettes** — palettes are ranked with `mood-engine-v2` and filtered like the theme demo.
4. Click **Apply** on a palette card — that palette’s six swatches become the candidate pool for `buildMoodWebsiteTheme` (roles + generated tokens + CSS variables).
