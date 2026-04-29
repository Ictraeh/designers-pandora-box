# Mood → Website theme demo

Branch: **`feature/website-theme-demo`**

Uses the **same JSON** as `../demo/data/` (Mindful + compact Pinterest). Loads `../demo/mood-engine-v2.js` logic for palette mood scoring, then runs a **website role pipeline** (`theme-pipeline.js`): OKLab distances, perceptual palette dedupe, candidate pool, greedy primary / secondary / tertiary / supplementary selection, WCAG-style on-colors, background & surface, and CSS variables.

## Run locally

Serve the **`Mood to Color`** directory (parent of `demo/` and `website-theme-demo/`) so `../demo/data/` resolves:

```bash
cd "/path/to/Designer's pandora box/Mood to Color"
python3 -m http.server 8888
```

Open: **http://localhost:8888/website-theme-demo/**

## Files

| File                 | Role                                                |
| -------------------- | --------------------------------------------------- |
| `mood-config.js`     | `MOOD_CHIPS`, `ABS_MIN_BY_MOOD`, scoring constants  |
| `mood-engine-v2.js`  | Copy of demo mood scorer                            |
| `palette-analyze.js` | Extracted `analyzePalette` + unified palette list |
| `theme-pipeline.js`  | OKLab enrich, pool, roles, Material-style tokens    |
| `theme-app.js`       | UI, fetch, score loop, render                       |

## Deploy (Vercel)

Point the project **root** to `Mood to Color` and set the dev command / output, **or** duplicate `demo/data` into this folder and change `DATA_BASE` in `theme-app.js` to `./data/`.
