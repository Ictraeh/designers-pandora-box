# Mood to Color

Maps **moods, emotions, and abstract adjectives** (large, extensible vocabulary) to **curated hex palettes**—today [Mindful Palettes](https://nopzon.com/tag/MindfulPalettes) (Alex Cristache) via `mindful-palettes.json`, tomorrow **Pinterest pins** using the schema in `schemas/pinterest-pin.schema.json`.

It is designed to stay **professionally grounded**: color supports meaning and hierarchy, but **culture, medium, brand, and accessibility** change readings. The framework embeds a **bibliography** of the sources you specified; the matcher uses **explicit axes + hue kernels**, not a black-box “AI knows feelings.”

## Files

| File | Purpose |
|------|---------|
| `mood-to-color-framework.json` | Axes definitions, matching rules, disclaimers, bibliography URLs, Pinterest notes |
| `mood-to-color-lexicon.json` | Seed lemma → hue / axis priors (expand per product glossary) |
| `match_palettes.py` | CLI: rank palettes for a query; merges **Mood to Motion Map** cluster adjectives when present |
| `schemas/pinterest-pin.schema.json` | JSON Schema for harvested pins (`dominantHex`, `description`, `moodTags`) |

## Motion ↔ Color bridge

`../Mood to Motion Map/mood-to-motion-map.json` lists **31 `moodClusters`** (adjectives + motion).  
`match_palettes.py` maps each cluster id to a **color prior** (`DEFAULT_CLUSTER_COLOR_PRIORS`) so the same language you use for motion can influence palette ranking without duplicating every adjective in the color lexicon.

## Run

Point `--palettes` at your Mindful Palettes export (or set `MINDFUL_PALETTES_JSON`). Default looks for:

`~/Desktop/Design Style Layout Markdown Library/Color system /Mindful Palletes/mindful-palettes.json`

```bash
cd "Mood to Color"
python3 match_palettes.py "warm organic calm spa" --top 8 --palettes "/path/to/mindful-palettes.json"
```

Output is JSON: `score`, `paletteNumber`, `summary`, `hexes`.

## Axes (summary)

Defined in `mood-to-color-framework.json`:

- **warmCool** — warm vs cool emphasis (cosine projection on hue; educational shorthand, not physics).
- **arousal** — chroma + lightness spread proxy (“energy”).
- **valence** — rough hedonic tone from overall lightness/chroma (weak prior).
- **sophistication** — restraint / editorial vs playful loud.
- **grounding** — earth / organic bias.
- **openness** — airy / approachable vs dense.

Palette side derives these from the **six swatches**; query side aggregates **matched lexicon entries** + optional **motion cluster lemmas**.

## Pinterest (next step)

1. Crawl or export pins → objects validating `schemas/pinterest-pin.schema.json`.
2. Run the same axis derivation on `dominantHex[]` (or full image k-means).
3. Merge pin lemmas into the query pipeline (treat each pin as a synthetic palette row).

Deduplicate near-identical pins with **ΔE2000** in the crawler layer.

## Bibliography (sources you linked)

Full list with stable `id` fields lives in **`mood-to-color-framework.json` → `bibliography`**. Canonical URLs include:

- [Adobe — Color meaning](https://www.adobe.com/creativecloud/design/discover/color-meaning.html)
- [Smartpress — Color psychology for marketing & sales](https://smartpress.com/blog/features/color-psychology-how-to-use-it-for-marketing-sales)
- [RMCAD — Psychology of color in graphic design](https://www.rmcad.edu/blog/the-psychology-of-color-in-graphic-design/)
- [LA Film School — Psychology of color](https://www.lafilm.edu/blog/the-psychology-of-color/)
- [Figma — What is color theory?](https://www.figma.com/resource-library/what-is-color-theory/)
- [Stoneside — Psychology of color in spaces](https://www.stoneside.com/resources/articles/interior-design-understanding-the-psychology-of-color-in-spaces)
- [Envato Elements — Color psychology](https://elements.envato.com/learn/color-psychology)
- [Color Palette Studio — Color psychology vs palette psychology](https://thecolorpalettestudio.com/blogs/resources-tips/color-psychology-vs-color-palette-psychology)
- [NN/g — Color as an aid to thinking](https://www.nngroup.com/articles/color-enhance-design/)
- [Platt — Psychology of color in graphic design](https://platt.edu/blog/psychology-color-graphic-design/)
- [Adobe Express UK — Colour psychology in marketing](https://www.adobe.com/uk/express/learn/blog/colour-psychology-in-marketing)
- [Bethany Works — Color psychology](https://bethanyworks.com/color-psychology/)
- [ColorPsychology.org](https://www.colorpsychology.org/)
- [Instapage — Ultimate guide to color psychology](https://instapage.com/blog/ultimate-guide-to-color-psychology)
- [Color Meanings](https://www.color-meanings.com/)

Use them as **design rationale and critique**, not as universal laws. NN/group and Color Palette Studio in particular caution against **overfitting** stories to single hues without palette / context / usability checks.

## Extending the vocabulary

1. Add lemma bundles to `mood-to-color-lexicon.json` (`entries[]`).
2. Optionally add industry-specific JSON (e.g. `lexicon-finance.json`) and merge in a small loader script later.
3. Keep **notes** per entry when associations are **culture-specific** (per Color Meanings / ColorPsychology.org).

## License / attribution

Mindful Palettes are **Alex Cristache’s** work; keep `sourceUri` from the JSON export when publishing derivative lists. This repo logic is a **ranking helper**, not a replacement for designer judgment or user research.
