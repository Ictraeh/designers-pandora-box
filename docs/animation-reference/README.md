# Animation reference (vibe coding)

Supplementary reference for AI-assisted website building: **official docs first**, **short first-party recipes**, **gallery links for ideas only** (do not bulk-copy third-party source).

**→ Step-by-step for prompts:** [prompt-workflow.md](./prompt-workflow.md) · **Mood words → Motion numbers:** [tone-to-motion.md](./tone-to-motion.md)

## How to use (quick)

1. Pick a **pattern** from `patterns.json` (or browse the Markdown files by topic).
2. Implement with **Motion by default**; escalate to GSAP or canvas only when the pattern notes say so.
3. Always respect **`prefers-reduced-motion`** and keep motion subtle on content-heavy pages.

## Files

| File | Purpose |
|------|---------|
| `patterns.json` | Machine-readable index: tags, engines, doc URLs |
| `motion.md` | Motion for React — when to use, core APIs |
| `gsap.md` | GSAP — when to use vs Motion |
| `animejs.md` | anime.js — good fits and doc entry |
| `css-tailwind.md` | CSS / Tailwind-first motion, tokens |
| `galleries.md` | Curated **links** to component galleries (ideas, not source) |
| `sources/` | **Per-library indexes:** [React Bits](sources/react-bits.md), [Magic UI](sources/magic-ui.md), [Animate UI](sources/animate-ui.md), [Kokonut UI](sources/kokonut-ui.md), [CuiCui](sources/cuicui.md) |
| `sources.json` | Machine-readable list of those hubs + URL patterns |
| `recipes.md` | Minimal copy-pasteable patterns (your codebase) |
| `prompt-workflow.md` | How to use this folder **inside vibe-coding / website prompts** (Cursor @, order, snippets) |
| `tone-to-motion.md` | Map vague language (“natural”, “elegant”) → **duration, easing, springs, distances** |
| `tone-vibes.json` | **Fuzzy triggers + full URLs** per vibe (v1.2+ = large `feelingKeywords` / `triggerPhrases` + meta clusters for speed, easing, intensity, direction) |

## Conventions

- **Engine tags:** `motion`, `gsap`, `anime`, `css`, `canvas`, `r3f`
- **Param knobs:** duration, delay, stagger, easing/spring, color (often via CSS variables), `once`, reduced motion

## License note

Gallery sites are **third-party**. Use them for inspiration and deep links; reimplement in your own components or follow each project’s license if you adapt code.
