# Color usage rules — demo summary

**Audience:** Designers and developers using the Meridian Atelier palette-switch demo (`palette-switch-ts-demo`) or the portable pipeline (`palette-switch-core`).

**Full spec:** [AI_PALETTE_SWITCH_GUIDELINES.md](./AI_PALETTE_SWITCH_GUIDELINES.md) (883 lines). This document is a **practical summary** of what the **current demo enforces in code**.

---

## 1. Core idea

Palette switching is **not** “swap green for green.” It is **replacing the job each color does**:

| Job | Examples |
|-----|----------|
| Canvas | Page background, large fields |
| Surface | Cards, panels, elevated areas |
| Text | Primary, secondary, muted copy |
| Action | Primary buttons, links, focus |
| Structure | Borders, dividers |
| Expression | Secondary/tertiary accents, decorative blocks |

When the user picks a new 6-swatch palette or hits **Shuffle**, the pipeline:

1. Maps swatches → semantic roles  
2. Enforces contrast and button rules  
3. Distributes remaining swatches across **visible color blocks**  
4. Writes CSS variables on `:root`  

**Mood fit never overrides failed contrast.**

---

## 2. Non‑negotiables (demo)

| Rule | What the demo does |
|------|---------------------|
| **Semantic mapping** | Swatches assigned to background, surface, primary/secondary/tertiary, text, border — not by hue name |
| **4.5:1 minimum** | All normal text and button labels on their backgrounds must pass **WCAG 4.5:1** (hard constant `MIN_CONTENT_CONTRAST = 4.5`) |
| **Keep light/dark identity** | Light/dark mode is inferred from the site; switching palette does **not** flip mode unless the user chooses it |
| **Six swatches ≠ full system** | Missing roles are synthesized (mix, OKLCH shift, Material tonal ladder) — never ship broken pairs to “stay in the hex list” |
| **Prefer original swatches** | Raw palette hex is used first; tonal expansion only when contrast or role rules fail |

---

## 3. How colors are applied (CSS variables)

The demo applies tokens to `document.documentElement`. Components use `var(--color-*)` or Tailwind aliases (`bg-canvas`, `text-ink`, `bg-bold`, etc.).

### 3.1 Semantic tokens (site-wide)

| Token | Role |
|-------|------|
| `--color-bg`, `--color-bg-alt` | Main canvas and alternate field |
| `--color-surface`, `--color-surface-muted` | Cards and soft panels |
| `--color-text-primary`, `--color-text-secondary`, `--color-text-muted` | Body copy hierarchy |
| `--color-primary`, `--color-primary-text` | Brand accent and **readable** accent-colored text on light fields |
| `--color-secondary`, `--color-tertiary` | Supporting accents |
| `--color-button-primary-bg`, `--color-button-primary-text`, `--color-button-primary-hover` | Primary CTA |
| `--color-button-secondary-*` | Secondary buttons (neutral styling) |
| `--color-tag-*` | Pills / tags (neutral styling) |
| `--color-border-subtle`, `--color-border-default` | Lines and dividers |

### 3.2 Multi-color block tokens (shuffle / showcase)

Used so the site shows **all six swatches**, not a single dominant hue:

| Token | UI use in demo |
|-------|----------------|
| `--color-section-bold-bg`, `--color-section-bold-text` | Full-width bold section (e.g. “Palette in use”) |
| `--color-block-1` … `--color-block-6` (+ `-text`, `-meta`) | Six swatch chips with H/S/L metadata |
| `--color-hero-bar-1` … `3` | Hero accent bars |
| `--color-card-icon-1` … `3` | Feature card icon fills |
| `--color-logo-1` … `3` | Logo / mark accents |
| `--color-kpi-accent-1` … `3` | KPI / stat highlights |
| `--color-nav-mark` | Nav brand mark |

**Shuffle** rotates which swatch fills the bold section and reassigns block slots — same palette, different **layout of color**.

### 3.3 Tailwind mapping (demo)

```text
canvas      → --color-bg
ink         → --color-text-primary
accent      → --color-primary
bold        → --color-section-bold-bg
bold-ink    → --color-section-bold-text
```

---

## 4. Contrast rules

### 4.1 Hard minimum: 4.5:1

Applies to:

- Primary and secondary text on **background** and **surface**
- Primary button label on **primary button fill**
- Links and accent text on readable fields
- Text on **bold section** backgrounds and **block** backgrounds

If a pair fails, the pipeline **nudges the foreground** (or in rare cases the primary fill) until it passes — never ships white-on-yellow CTAs.

### 4.2 Text on colored blocks: background-driven

For section bold areas and palette chips, label color is chosen from **that block’s background lightness**, not from whether the site is “light mode” or “dark mode”:

- Light block (L ≥ ~55%) → dark label  
- Dark block → light label  

This prevents dark text on dark bold sections.

### 4.3 Accent on large fields

- **Canvas / surface:** low chroma, appropriate lightness for mode  
- **Saturated swatches:** for buttons, pills, bars, icons — **not** full-page backgrounds  
- Light mode: very dark accents on large light fields are restricted unless label contrast still passes  

### 4.4 Hierarchy (after mapping)

**Light mode (simplified):**

- Text darker than canvas  
- Surface close to or slightly below canvas lightness  
- Primary visible on background (≥ ~3:1 for accent presence)  
- Button label ≥ 4.5:1 on primary  

**Dark mode:**

- Surface lighter than background  
- Text lighter than surface  
- Same contrast floors  

---

## 5. Button and control rules

These are **stricter than generic “brand colors on buttons”** in the demo:

### 5.1 Primary button

| Rule | Detail |
|------|--------|
| **Fill** | May use theme primary (accent) |
| **Label** | **Neutral only** — semantic text colors or off-black/off-white presets (`#07100C`, `#F6F8F3`, greys). **Never** primary/secondary/tertiary hex as button text |
| **Contrast** | Label must be ≥ **4.5:1** on fill; recomputed after accent rotation on shuffle |
| **Failure fix** | If no neutral passes, primary fill is lightened/darkened in OKLCH until a label works |

### 5.2 Secondary button and tags

| Rule | Detail |
|------|--------|
| **No accent stacking** | Fill, border, and text are **neutral** (surface/muted mixes) |
| **Max one theme hue per control** | Do not pair accent text + accent border on the same pill (e.g. yellow text + green border) |
| **Label** | Same neutral-only rule as primary |

### 5.3 Links and accent text

`--color-primary-text` and links are checked on **background** and **surface** so eyebrow/headline accent copy stays readable.

---

## 6. Multi-color layout (no gradients)

The demo intentionally avoids gradient washes for palette testing:

- **Solid fills** per block  
- Six swatches analyzed in **OKLCH**: hue (H), chroma as saturation (S), lightness (L)  
- **Bold section** picks a vivid (non-neutral) swatch; rotates on shuffle  
- Other slots: hero bars, card icons, logos, KPIs get **distinct** rotated swatches  

Metadata on chips: `H{n}° · S{n}% · L{n}%` via `--color-block-N-meta`.

---

## 7. Palette input and pipeline

### 7.1 Input

Each candidate palette has **six hex swatches** + optional summary text (Mindful / Pinterest / supplement JSON in `public/data`).

### 7.2 Processing order

```text
Analyze current site → build signature & contrast contract
    → filter/rank candidates (mood axes optional)
    → map swatches to roles (prefer raw hex)
    → synthesize missing roles (tonal ladder if needed)
    → validate & repair
    → reject known failure patterns
    → score & rank
    → emit CSS tokens (+ block tokens on shuffle)
    → apply to :root
```

### 7.3 Shuffle within palette

`shuffleColorsWithinPalette`:

- Rotates primary / secondary / tertiary assignment  
- Passes `paletteHexes` + `blockVariant` into block planner  
- Re-runs button label contrast after rotation  

User sees **new color blocks** without changing the palette ID.

---

## 8. Composition guidelines (design + demo)

| Guideline | Application |
|-----------|-------------|
| **60‑30‑10** | ~60% neutral canvas, ~30% brand/secondary presence, ~10% accent for CTAs and highlights |
| **≤ 3 hues** | Plus neutrals; six swatches are **inputs** — UI still reads as controlled hierarchy |
| **Consistency** | Same token names site-wide; palette panel only changes variables |
| **Not color-only** | Focus rings, labels, and structure still required for a11y (demo uses visible borders and text) |
| **No red/green-only state** | Use icons/labels for critical states (product rule; demo is marketing-focused) |

---

## 9. What to avoid

| Don’t | Why |
|-------|-----|
| Map by hue (“old blue → new blue”) | Breaks role relationships |
| Use accent color for button text | Fails contrast or looks like one-color site; demo blocks this |
| Put accent text + accent border on tags | Dual-accent controls; demo uses neutrals |
| Assume light mode → dark text everywhere | Bold sections need **background-based** contrast |
| Use saturated swatch as full-page bg | Reserved for blocks/CTAs; canvas stays calm |
| Rely on gradients to “blend” palette | Demo uses flat blocks to **test** swatches clearly |
| Skip synthesis when palette lacks a role | Pipeline derives neutrals/borders/text |

---

## 10. Demo controls (user-facing)

| Control | Effect |
|---------|--------|
| **Mood chips** | Prioritize palette candidates from precomputed rankings |
| **Palette list** | Apply full mapped theme + block tokens |
| **Shuffle colors** | Rotate accents + block layout within current palette |
| **Light / dark** | Re-map with mode-specific canvas/surface rules (identity preserved per palette) |
| **Safe / creative / surprise** | Scoring weight for freshness vs continuity |

---

## 11. Implementation reference

| Asset | Path |
|-------|------|
| Portable TS pipeline | `palette-switch-core/` (`themePipeline.ts`, `palette-blocks.ts`, `material-tonal.ts`) |
| Demo app | `palette-switch-ts-demo/` |
| Apply tokens to DOM | `apply-theme.ts` → `applyThemeResult()` |
| Full AI spec | `AI_PALETTE_SWITCH_GUIDELINES.md` |
| Core usage README | `palette-switch-core/README.md` |

**Quick apply:**

```ts
import { applyThemeResult, shuffleColorsWithinPalette } from './palette-switch-core';

applyThemeResult(alternative);           // full theme
applyThemeResult(shuffleResult);           // rotated blocks + accents
```

---

## 12. Checklist before shipping a palette on a new site

- [ ] All text on `--color-bg` and `--color-surface` ≥ **4.5:1**  
- [ ] Primary button label neutral and ≥ **4.5:1** on `--color-button-primary-bg`  
- [ ] Tags/secondary buttons use **neutral** triplets only  
- [ ] Bold sections use `--color-section-bold-text` on `--color-section-bold-bg`, not generic muted text  
- [ ] Block/chip text uses `--color-block-N-text` on `--color-block-N`  
- [ ] Large fields stay low-chroma; accents on CTAs and blocks  
- [ ] Shuffle/block tokens wired if you want multi-color expression  
- [ ] Light/dark mode not flipped unintentionally  

---

*Generated from the Meridian Atelier demo and `palette-switch-core` pipeline. For algorithm detail, scoring weights, and mood-axis integration, see the full guidelines document.*
