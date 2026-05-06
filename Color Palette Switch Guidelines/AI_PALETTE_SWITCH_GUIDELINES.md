# AI guidelines: color system / palette switching (frontend)

**Audience:** coding agents and frontend developers implementing “switch my site’s palette” or “apply a mood-based palette” flows.  
**Goal:** When the user changes color system, **preserve the site’s color *relationships*** (roles, contrast rhythm, light/dark identity, interaction visibility)—not swap hex values naively.

**Related assets (authoritative for mood + palette inventory):**

| Asset | Path |
|--------|------|
| Mood → palette framework (axes, matching rules, bibliography) | `/Users/wenjiacreatie/Desktop/Designer's pandora box/Mood to Color/mood-to-color-framework.json` |
| Mood lexicon (lemma → hue / axis priors) | `/Users/wenjiacreatie/Desktop/Designer's pandora box/Mood to Color/mood-to-color-lexicon.json` |
| Example palette data (6 hexes + `paletteSummary` per row) | `/Users/wenjiacreatie/Desktop/Designer's pandora box/Mood to Color/demo/data/mindful-palettes.json` |
| CLI matcher (optional implementation reference) | `/Users/wenjiacreatie/Desktop/Designer's pandora box/Mood to Color/match_palettes.py` |
| Pinterest pin schema (future sources) | `/Users/wenjiacreatie/Desktop/Designer's pandora box/Mood to Color/schemas/pinterest-pin.schema.json` |

Users pick replacement colors from **curated palettes** exposed by the Mood to Color sidecar (Mindful Palettes–style rows: six `hex` swatches + summary text). Your job is to **filter** those candidates, **score** them against the *current* theme’s signature, **map** swatches to semantic roles, and **synthesize** any missing roles using the rules below.

---

## 0. Non‑negotiables

1. **Map by semantic role**, not by “green → green”. Example intent:

   - Wrong: `oldGreen → newGreen`, `oldBlack → newBlack`  
   - Right: `oldPrimaryAction → newPrimaryAction`, `oldBackground → newBackground`, `oldSurface → newSurface`, `oldTextPrimary → newTextPrimary`, `oldBorder → newBorder`, `oldDecorativeAccent → newDecorativeAccent`

2. **Accessibility and hierarchy override mood fit** (see framework disclaimers in `mood-to-color-framework.json`: NN/g + palette psychology, not single‑swatch stories).

3. **Do not flip light/dark mode** unless the user explicitly asks (e.g. dark neon site stays dark by default).

4. **Six swatches are inputs, not a complete design system.** If the palette cannot supply a role after best effort, **derive** that role (mix, lighten/darken, neutralize) per §8—never ship a broken contrast pair to “stay inside the hex list only.”

---

## 1. Mental model

Palette switching = replacing a **color system relationship**. The new palette must keep:

- Role hierarchy (background vs surface vs text vs accent)  
- Contrast *classes* (subtle border vs loud CTA—not necessarily identical ratios)  
- Light/dark balance and “mode identity”  
- Interaction visibility (links, focus, active, disabled)

Example: **neon green + grey + black + white** usually reads as **dark, high‑contrast, tech/energy**: neon = action/accent; black = base; greys = layered surfaces; white/light grey = text. A valid replacement keeps those **jobs** even if hues change.

---

## 2. Extract the current theme signature (“design DNA”)

Before ranking Mood palettes, analyze the **current** theme (tokens if present; else infer from DOM/CSS).

For each relevant color / token, derive (conceptually or in code):

| Signal | Use |
|--------|-----|
| Hue, lightness, chroma | Match accent power, neutrality of base |
| Temperature | Continuity when swapping base/surface |
| Contrast vs its typical background | Role detection + contrast contract |
| Usage (area, interactive, text, border) | Disambiguate same hex used in two jobs |
| Visual priority | Accent vs decorative |

**Illustrative object** (shape may vary in implementation):

```js
const currentSignature = {
  mode: "dark",                    // "dark" | "light"
  mood: "tech / energy / cyber",   // free text + optional motion cluster / user query
  contrastStyle: "high",
  accentStyle: "neon",             // e.g. neon | muted | pastel | ...
  baseStyle: "black-grey",
  temperature: "cool-neutral",
  saturationPattern: {
    background: "very low chroma",
    surfaces: "low chroma",
    primary: "very high chroma",
    text: "neutral high contrast"
  },
  roleContrast: {
    textOnBackground: 20.1,
    textOnSurface: 15.2,
    primaryOnBackground: 15.8,
    primaryTextPair: 15.8,
    borderOnBackground: 1.5
    // extend with button text on primary, link on bg, focus on bg, etc.
  }
};
```

This signature is what you **preserve**; hue is what you **may** change.

---

## 3. Mood + palette filtering (Mood to Color integration)

### 3.1 Candidate source

Treat each row as **`{ id, paletteSummary, colors: [{ slot, hex }, … ×6] }`** (see `mindful-palettes.json`). User mood may be:

- Natural language (“serene luxury”, “cyber festival”)  
- Lemmas resolved via `mood-to-color-lexicon.json`  
- Optional motion cluster language (see `match_palettes.py` / Motion Map note in framework)

### 3.2 Axes from the framework (for gating and ranking)

From `mood-to-color-framework.json` → `axesDefinition`, palettes and queries can be compared on:

- **warmCool** — warm vs cool emphasis  
- **arousal** — energy (chroma + spread proxy)  
- **valence** — rough hedonic / light–dark emotional read (weak prior)  
- **sophistication** — restrained vs playful  
- **grounding** — earth / organic bias  
- **openness** — airy vs dense  

**Filtering rule:** Use axes + user mood to **narrow** candidates *before* deep contrast scoring when the user asks for a mood shift (e.g. “calmer”, “more luxury”). Always apply **hard gates** in §7 after a trial role mapping.

**Matching weights (default intent from framework):** hue kernel + axis similarity + small text boost from `paletteSummary` lemmas—see `matchingRules.weightsDefault`. Accessibility and role coverage are **additional** layers this document adds for **UI systems**, not replacements for the mood matcher.

### 3.3 Combined score (conceptual)

When presenting “best palettes for this site + this mood”, combine:

```text
finalReplacementScore =
  roleCompatibility      * 0.35 +
  contrastPreservation   * 0.30 +
  moodContinuity         * 0.18 +
  aestheticFreshness     * 0.12 +
  accessibilitySafety    * 0.05
```

Tune weights if product UX requires stricter WCAG—but **never** drop hard failures (§10) into results.

| Factor | Meaning |
|--------|---------|
| Role compatibility | Can six swatches (± synthesis) cover background, surface, primary, text, border, decorative? |
| Contrast preservation | Mapped theme keeps similar readability *classes* |
| Mood continuity | Palette + summary align user intent / signature mood |
| Aesthetic freshness | Meaningfully different from current (hue / temperature), per switch mode |
| Accessibility safety | Text, controls, links, focus still legible |

---

## 4. Pipeline (execute in order)

Use this whenever the user asks for alternate palettes for the **same** layout/site.

1. Analyze current theme tokens (or infer raw CSS colors).  
2. Build **current visual signature** (§2).  
3. Build **contrast contract** from measured pairs (§6).  
4. Pull **candidate palettes** from Mood to Color data; pre-filter by mood/axes if requested (§3).  
5. For each candidate: **map** swatches → roles (§5, §7). **Synthesize** missing roles (§8).  
6. **Validate** accessibility + hierarchy (§6, §10, §14).  
7. If fixes are minor (tone nudge), adjust; else **reject** candidate.  
8. Rank survivors by combined score + freshness; return top N with explanations (§11).

---

## 5. Role inventory and inference

### 5.1 If design tokens exist

Prefer explicit roles, e.g.:

`primary`, `secondary`, `tertiary`, `supplementary`, `background`, `surface`, `textPrimary`, `textSecondary`, `border`, `link`, `focusRing`, `buttonPrimaryText`, …

### 5.2 If only raw colors exist

Infer roles using **usage** + **contrast** + **chroma**, not hue alone:

```js
function inferThemeRoles(colors, usageData) {
  return {
    background: findLargestAreaDarkOrLightColor(colors, usageData),
    surface: findLayerColor(colors, usageData),
    primary: findMostSaturatedInteractiveColor(colors, usageData),
    secondary: findSupportAccent(colors, usageData),
    tertiary: findDecorativeOrHighlightColor(colors, usageData),
    textPrimary: findHighestContrastTextColor(colors, usageData),
    textSecondary: findMutedReadableTextColor(colors, usageData),
    border: findLowContrastLineColor(colors, usageData),
    focusRing: findInteractiveAccent(colors, usageData)
  };
}
```

**Heuristic sketch** (refine with your telemetry):

```js
function detectColorRole(color, usage) {
  if (usage.areaRatio > 0.35 && color.c < 0.08) return "background";
  if (usage.isText && usage.contrastAgainstBg >= 4.5) return "text";
  if (usage.isButton || usage.isLink || usage.isActiveState) return "primaryAction";
  if (usage.isBorder && usage.contrastAgainstBg >= 1.15 && usage.contrastAgainstBg <= 2.2) {
    return "border";
  }
  if (usage.isDecoration && color.c > 0.12) return "decorativeAccent";
  return "unknown";
}
```

---

## 6. Contrast contract (preserve relationships)

Measure key pairs on the **current** theme, then require the **mapped** theme to stay in the same **contrast class** band where layout depends on it.

**Illustrative contract:**

```js
const contrastContract = {
  textPrimaryOnBackground: {
    current: 20.1,
    min: 7.0,
    preserveClass: "veryHigh"
  },
  textSecondaryOnBackground: {
    current: 9.8,
    min: 4.5,
    preserveClass: "high"
  },
  primaryOnBackground: {
    current: 15.8,
    min: 4.5,
    preserveClass: "highAccent"
  },
  buttonTextOnPrimary: {
    current: 15.2,
    min: 4.5,
    preserveClass: "high"
  },
  borderOnSurface: {
    current: 1.45,
    min: 1.2,
    max: 2.2,
    preserveClass: "subtle"
  },
  cardOnBackground: {
    current: 1.3,
    min: 1.08,
    max: 1.8,
    preserveClass: "softLayer"
  },
  decorativeOnBackground: {
    current: 1.8,
    min: 1.15,
    max: 3.0,
    preserveClass: "visibleButNotDominant"
  }
};
```

**Dark neon–style expectations:** very readable light text; surfaces visibly lifted from base; accent loud on base; borders subtle; decorative visible but not competing.

---

## 7. Candidate palette: role coverage gate

Ask: *Can this palette **perform** the UI jobs after mapping + minimal synthesis?*

| Needed role | Typical swatch profile |
|-------------|-------------------------|
| Background | Very dark **or** very light neutral (low chroma) |
| Surface | Close to background, small contrast step |
| Primary / action | Distinctive, higher chroma, strong on base |
| Text primary | High contrast on background |
| Text secondary | Softer but still ≥ 4.5 : 1 on relevant surfaces |
| Border | Low-contrast line color vs adjacent fills |
| Decorative | Accent or tint supporting mood without stealing CTA |

**Coverage score sketch:**

```js
function roleCoverageScore(candidatePalette, currentSignature) {
  const colors = candidatePalette.colors;
  const hasBase = hasValidBackgroundCandidate(colors, currentSignature.mode);
  const hasSurface = hasValidSurfaceCandidate(colors, currentSignature.mode);
  const hasAccent = hasValidAccentCandidate(colors, currentSignature.accentStyle);
  const hasText = hasValidTextCandidate(colors, currentSignature.mode);
  const hasBorder = hasValidBorderCandidate(colors, currentSignature.mode);
  return weightedAverage([
    [hasBase, 0.25],
    [hasSurface, 0.18],
    [hasAccent, 0.25],
    [hasText, 0.22],
    [hasBorder, 0.10]
  ]);
}
```

Palettes with **no** plausible dark base **and** no path via synthesis for a **declared dark** site should **fail early** unless the user opts into light mode.

---

## 8. Map Mood palette → existing roles + **auto‑fill** when swatches are insufficient

### 8.1 Strategy

```js
function mapPaletteToExistingTheme(candidatePalette, currentTheme, currentSignature) {
  const colors = candidatePalette.colors;

  const background = selectReplacementBackground(colors, currentTheme.background, currentSignature);
  const surface = selectReplacementSurface(colors, background, currentTheme.surface, currentSignature);
  const primary = selectReplacementPrimary(colors, background, currentTheme.primary, currentSignature);
  const textPrimary = selectReplacementText(colors, background, currentTheme.textPrimary, "primary");
  const textSecondary = selectReplacementText(colors, background, currentTheme.textSecondary, "secondary");
  const border = selectReplacementBorder(colors, background, surface, currentTheme.border);
  const tertiary = selectReplacementDecorativeAccent(colors, primary, background, currentSignature);

  return {
    background,
    surface,
    primary,
    secondary: surface,
    tertiary,
    supplementary: background,
    textPrimary,
    textSecondary,
    border,
    focusRing: primary
  };
}
```

Adjust keys to your token set (`link`, `buttonPrimaryText`, etc.).

### 8.2 Auto‑fill policy (critical)

If the palette **lacks** a suitable swatch for a role:

1. **Prefer** mixing / adjusting from **palette‑native** parents: e.g. border = `mix(textPrimary, background, ~0.82)` in dark mode; surface step from background ± lightness while **desaturating**.  
2. **Generate readable text** when no swatch meets 4.5:1 (see §9.4).  
3. **Never** assign the same hex to unrelated roles when that collapses hierarchy (e.g. border === background) **unless** design intentionally uses opacity borders—then document that separately.

This satisfies: *“If there are colors missing or not in the palette, follow the rule to fill automatically.”*

---

## 9. Replacement selection notes (summarized from reference implementation)

### 9.1 Primary (accent / action)

Preserve **function**: high chroma, high visibility on base, interactive signal—not necessarily same hue.

**Poor swaps:** dusty sage, beige, pale grey as **primary** for a neon‑energy system (unless user explicitly wants de‑emphasized actions).

**Selection sketch:**

```js
function selectReplacementPrimary(colors, background, oldPrimary, signature) {
  return selectBest(colors, (color) => {
    if (color.hex === background.hex) return 0;
    const contrast = contrastRatio(color.hex, background.hex);
    const hueFreshness = hueDistance(color.h, oldPrimary.h) / 180;
    const chromaSimilarity = 1 - Math.min(1, Math.abs(color.c - oldPrimary.c) / 0.25);
    const lightnessFit = bandScore(color.l, 0.52, 0.82, 0.18);
    const accentPower =
      color.c > 0.16 ? 1 :
      color.c > 0.10 ? 0.7 :
      0.25;
    const visibility = contrast >= 4.5 ? 1 : contrast / 4.5;
    const neonContinuity =
      signature.accentStyle === "neon"
        ? color.c > 0.20 && color.l > 0.55 ? 1 : 0.45
        : 0.7;
    return clamp01(
      visibility * 0.30 +
      accentPower * 0.25 +
      chromaSimilarity * 0.16 +
      lightnessFit * 0.12 +
      neonContinuity * 0.12 +
      hueFreshness * 0.05
    );
  });
}
```

### 9.2 Background

Dark sites: keep **dark**, low‑chroma base; subtle tint allowed (blue‑black, plum‑black, espresso). Avoid saturated full‑field backgrounds for standard web UI.

### 9.3 Surface

Dark mode: surface **lighter** than background; typical background↔surface contrast ratio **~1.08–1.8** (tunable). Too high = chunky cards; too low = lost layers.

### 9.4 Text

Optimize for **contrast classes**; soften pure `#000`/`#fff` pairs when aesthetics suffer:

```js
function generateReadableText(background, level) {
  const bg = enrichColor(background.hex || background);
  const isDarkBg = bg.l < 0.45;
  if (isDarkBg) {
    return {
      hex: level === "primary" ? "#F2F4F0" : "#B9C0BC",
      role: level === "primary" ? "textPrimary" : "textSecondary"
    };
  }
  return {
    hex: level === "primary" ? "#181C1A" : "#4B5550",
    role: level === "primary" ? "textPrimary" : "textSecondary"
  };
}
```

### 9.5 Border

Match **subtlety class** vs old border; if no candidate:

```js
function generateBorder(background, textPrimary, mode) {
  return mode === "dark"
    ? mixHex(textPrimary.hex, background.hex, 0.82)
    : mixHex(textPrimary.hex, background.hex, 0.88);
}
```

---

## 10. Hierarchy and hard accessibility rejects

### 10.1 Ordering intent

**Dark mode ladder:**  
`background` (darkest) < `surface` (slightly lighter) < `border` (subtle) < `textMuted` < `textPrimary` < `accent` (loud but controlled)

**Light mode:** invert lightness relationships appropriately; accent still visible but not “vibrating” on white fields.

**Validator sketch:**

```js
function validateHierarchy(theme, mode) {
  const bg = enrichColor(theme.background.hex);
  const surface = enrichColor(theme.surface.hex);
  const text = enrichColor(theme.textPrimary.hex);
  const accent = enrichColor(theme.primary.hex);

  if (mode === "dark") {
    if (!(surface.l > bg.l)) return false;
    if (!(text.l > surface.l)) return false;
    if (contrastRatio(theme.textPrimary.hex, theme.background.hex) < 4.5) return false;
    if (contrastRatio(theme.primary.hex, theme.background.hex) < 3.0) return false;
  }

  if (mode === "light") {
    if (!(surface.l <= bg.l || Math.abs(surface.l - bg.l) < 0.04)) return false;
    if (!(text.l < bg.l)) return false;
    if (contrastRatio(theme.textPrimary.hex, theme.background.hex) < 4.5) return false;
    if (contrastRatio(theme.primary.hex, theme.background.hex) < 3.0) return false;
  }

  return true;
}
```

### 10.2 Accessibility checks (production bar)

```js
function accessibilitySafetyScore(theme) {
  const checks = [
    contrastRatio(theme.textPrimary.hex, theme.background.hex) >= 4.5,
    contrastRatio(theme.textSecondary.hex, theme.background.hex) >= 4.5,
    contrastRatio(theme.buttonPrimaryText.hex, theme.primary.hex) >= 4.5,
    contrastRatio(theme.link.hex, theme.background.hex) >= 4.5,
    contrastRatio(theme.focusRing.hex, theme.background.hex) >= 3.0,
    contrastRatio(theme.border.hex, theme.background.hex) >= 1.15,
    contrastRatio(theme.surface.hex, theme.background.hex) >= 1.08
  ];
  return checks.filter(Boolean).length / checks.length;
}

function hasCriticalAccessibilityFailure(theme) {
  return (
    contrastRatio(theme.textPrimary.hex, theme.background.hex) < 4.5 ||
    contrastRatio(theme.buttonPrimaryText.hex, theme.primary.hex) < 4.5 ||
    contrastRatio(theme.focusRing.hex, theme.background.hex) < 3.0
  );
}
```

**Hard reject** any candidate whose mapped + synthesized theme fails `hasCriticalAccessibilityFailure` or hierarchy validation.

---

## 11. Contrast class preservation (for scoring)

Exact ratios need not match; **contrast class** should:

```js
function contrastClass(ratio) {
  if (ratio < 1.2) return "barely";
  if (ratio < 2.2) return "subtle";
  if (ratio < 3.5) return "visible";
  if (ratio < 4.5) return "strongNonText";
  if (ratio < 7) return "readable";
  if (ratio < 12) return "high";
  return "veryHigh";
}

function contrastClassSimilarity(oldRatio, newRatio) {
  const oldClass = contrastClass(oldRatio);
  const newClass = contrastClass(newRatio);
  if (oldClass === newClass) return 1;
  const oldLog = Math.log(oldRatio);
  const newLog = Math.log(newRatio);
  return clamp01(1 - Math.abs(oldLog - newLog) / 1.15);
}
```

Use weighted pairs (text/background, secondary/background, primary/background, button text/primary, surface/background, border/background, tertiary/background) similar to your product’s emphasis.

---

## 12. Switch modes (user intent)

```js
const PALETTE_SWITCH_MODE = {
  safe: {
    moodShiftAllowed: 0.15,
    hueShiftTarget: [25, 90],
    contrastStrictness: 0.95,
    saturationShiftAllowed: 0.20
  },
  creative: {
    moodShiftAllowed: 0.35,
    hueShiftTarget: [60, 150],
    contrastStrictness: 0.90,
    saturationShiftAllowed: 0.35
  },
  surprise: {
    moodShiftAllowed: 0.55,
    hueShiftTarget: [100, 180],
    contrastStrictness: 0.85,
    saturationShiftAllowed: 0.45
  }
};
```

- **Safe:** same mood family; hue freshening.  
- **Creative:** bolder hue/mood shift; still lock contrast skeleton.  
- **Surprise:** strong mood pivot; non‑negotiable usability.

---

## 13. Orchestration helper (reference)

```js
function suggestAlternativeThemes({
  currentTheme,
  candidatePalettes,
  switchMode = "creative",
  maxResults = 12
}) {
  const signature = analyzeCurrentTheme(currentTheme);
  const results = [];

  for (const palette of candidatePalettes) {
    const enrichedPalette = enrichPalette(palette);
    const mappedTheme = mapPaletteToExistingTheme(
      enrichedPalette,
      currentTheme,
      signature
    );

    if (hasCriticalAccessibilityFailure(mappedTheme)) continue;
    if (!validateHierarchy(mappedTheme, signature.mode)) continue;

    const score = scorePaletteAsReplacement(enrichedPalette, currentTheme, {
      switchMode
    });
    if (score <= 0) continue;

    results.push({
      paletteId: palette.id,
      score,
      theme: mappedTheme,
      reasons: explainPaletteSwitch(mappedTheme, currentTheme, signature)
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
```

---

## 14. Explain results to the user

```js
function explainPaletteSwitch(newTheme, oldTheme, signature) {
  const reasons = [];
  const oldPrimaryHue = enrichColor(oldTheme.primary.hex).h;
  const newPrimaryHue = enrichColor(newTheme.primary.hex).h;
  const hueShift = hueDistance(oldPrimaryHue, newPrimaryHue);

  if (hueShift > 45) {
    reasons.push("Primary accent changes hue enough to feel fresh.");
  }
  if (contrastRatio(newTheme.textPrimary.hex, newTheme.background.hex) >= 7) {
    reasons.push("Main text keeps strong readability on the new background.");
  }
  if (contrastRatio(newTheme.primary.hex, newTheme.background.hex) >= 4.5) {
    reasons.push("Accent color remains highly visible for buttons and links.");
  }
  if (contrastRatio(newTheme.surface.hex, newTheme.background.hex) <= 1.8) {
    reasons.push("Surface layers stay subtle and close to the original layout depth.");
  }
  if (signature.accentStyle === "neon") {
    reasons.push("The replacement preserves the neon accent behavior.");
  }
  return reasons;
}
```

---

## 15. Known failure patterns (reject / fix)

| Failure | Example | Why it breaks |
|---------|---------|----------------|
| Muted primary for high‑energy UI | `#39FF14 → #7A8F72` | CTAs read disabled; mood collapses |
| Mid‑grey “background” on dark UI | `#050505 → #777777` | Loses dark identity; hierarchy muddy |
| Light bg + light text | bg `#F5F5F5`, text `#FFFFFF` | Illegible |
| Saturated surfaces everywhere | neon bg + neon cards | Eye strain; unreadable |

---

## 16. One‑screen rule summary for agents

```js
const AlternativePaletteMust = {
  preserve: [
    "semantic color roles",
    "text contrast",
    "button contrast",
    "background/surface hierarchy",
    "focus visibility",
    "interaction clarity",
    "mode identity"
  ],
  allowChange: [
    "accent hue",
    "temperature",
    "surface tint",
    "mood nuance",
    "decorative color",
    "saturation expression within safe bands"
  ],
  rejectWhen: [
    "text contrast fails",
    "primary action disappears",
    "surface hierarchy collapses",
    "background mode unintentionally flips",
    "new palette cannot supply required roles even after synthesis",
    "critical a11y failure"
  ]
};
```

**Designer–engineer takeaway:** A successful palette switch keeps the **contrast skeleton** while changing the **emotional skin**—for a neon + grey + black + white site, the replacement still needs a strong accent, readable text, subtle dark layers, and clear action/link/focus colors, whether the accent becomes cyan, violet, amber, magenta, or gold.

---

## 17. Worked mini‑example (neon tech → safe cyan)

**Before:** background `#050505`, surface `#1A1A1A`, primary `#39FF14`, text `#FFFFFF` / `#B8B8B8`, border `#333333`, button text on primary dark, link/focus = primary.

**After (safe cyber direction):** keep **dark base + layered neutrals + neon‑class accent + light text**; shift hue toward cyan. Validate all §10 checks and hierarchy before showing to the user.

---

### Changelog

- **v1.0** — Consolidated from internal palette-switch spec + wired to Mood to Color file paths and 6‑swatch auto‑fill policy.
