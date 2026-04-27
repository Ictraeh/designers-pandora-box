# The Animation Feeling-to-Code Translation Library

A structured **“Vibe → Code”** reference: natural language feelings map to **measurable** animation properties (timing, easing, scale, opacity, springs). Use it as a **creative brief decoder** for UI motion—then implement with **`motion/react`** (Motion for React) or CSS.

**Stack note:** examples use `motion/react`. Spring props match Motion’s API (`type: "spring"`, `stiffness`, `damping`).

---

## How translation works (three pillars)

1. **Feeling → timing** — duration tells users if motion is urgent, calm, or cinematic.  
2. **Feeling → easing** — the curve is the *personality* (overshoot = playful, expo-out = premium).  
3. **Feeling → property** — *what* moves matters: scale = presence, translateY = gravity, opacity = existence, blur = “materializing”.

Every entry below has **`triggerPhrases`** for fuzzy matching in prompts or tooling, plus **`motionHint`** / **`cssVars`** you can paste into codegen.

After picking a vibe, still tag a **`patterns.json`** id (`enter-fade-up`, `hover-tap-micro`, …) so your repo stays searchable.

**Machine index:** [`tone-vibes.json`](./tone-vibes.json) — every vibe has `triggerPhrases`, `feelingKeywords`, and **`externalRefs`** (full URLs to [Motion](https://motion.dev/docs/react), [anime.js](https://animejs.com/documentation/animation/), [GSAP](https://gsap.com/docs/v3/), [Theatre.js](https://www.theatrejs.com/docs), [React Bits](https://reactbits.dev/), [Magic UI](https://magicui.design/docs/components), [Animate UI](https://animate-ui.com/docs), [Kokonut UI](https://kokonutui.com/docs), [CuiCui](https://cuicui.day/common-ui)). Fuzzy word clusters → which tabs to open live in `feelingKeywordToSites` in that file.

---

## AI routing — vague feelings → open the right docs

When the user speaks in **mood words only** (no component names), run this sequence:

1. **Token-match** user text against `tone-vibes.json` → `vibes[].triggerPhrases` and `feelingKeywords` (case-insensitive, substring OK).  
2. If multiple hits, prefer the **most specific** phrase match; else use `feelingKeywordToSites` by overlapping keywords.  
3. For the winning vibe `id`, open **every** URL in `externalRefs` (Motion first, then galleries).  
4. Implement from **Motion + your design tokens**; use gallery pages for **layout/props ideas** only.  
5. Record `patternsJson` from that vibe into comments / PR description.

**Synonym coverage:** the JSON expands common synonyms (e.g. *classy, polished, understated* → elegant cluster; *wonder, mystical* → magical). Add more strings to `tone-vibes.json` as your users’ language evolves.

---

## Layer 1 — feeling taxonomy (top-level)

| Feeling category | Sub-tags (keywords) | Emotional intent |
|------------------|---------------------|-------------------|
| Magical | sparkle, glow, beam, shimmer | Delight, wonder, premium |
| Natural | fluid, organic, breathing, drift | Calm, alive, responsive |
| Reactive | snap, bounce, pulse, ripple | Feedback, energy, immediacy |
| Elegant | fade, silk, glide, refine | Sophistication, restraint |
| Bold | slam, pop, burst, charge | Confidence, drama, impact |
| Subtle | whisper, hint, ghost, trace | Ambient, non-intrusive |
| Precise | click, lock, confirm, settle | Control, accuracy, trust |

---

## Meta-rules — the translation engine

Paste or import this logic into generators / MCP. Values are **ranges** (pick a number inside).

```javascript
export const TRANSLATION_RULES = {
  speed: {
    "instant / immediate / snappy": { durationMs: [100, 200] },
    "quick / fast / responsive": { durationMs: [200, 350] },
    "smooth / natural / comfortable": { durationMs: [350, 550] },
    "slow / deliberate / cinematic": { durationMs: [600, 1000] },
    "very slow / ambient / drifting": { durationMs: [1500, 8000] },
  },
  personalityToBezier: {
    "playful / bouncy / fun": [0.34, 1.56, 0.64, 1],
    "elegant / refined / premium": [0.16, 1, 0.3, 1],
    "natural / organic / fluid": [0.25, 0.46, 0.45, 0.94],
    "snappy / decisive / confident": [0.22, 1, 0.36, 1],
    "mechanical / precise / digital": [0.36, 0.07, 0.19, 0.97],
    "gentle / subtle / ambient": "easeInOut",
  },
  intensity: {
    barely_noticeable: { scale: [0.99, 1.01], opacity: [0.8, 1.0] },
    subtle: { scale: [0.97, 1.03], opacity: [0.6, 1.0] },
    normal: { scale: [0.94, 1.06], opacity: [0, 1] },
    dramatic: { scale: [0.85, 1.15], opacity: [0, 1] },
    extreme: { scale: [0.5, 1.2], opacity: [0, 1] },
  },
  direction: {
    from_below: { from: { y: 16 }, to: { y: 0 } },
    from_above: { from: { y: -16 }, to: { y: 0 } },
    from_left: { from: { x: -24 }, to: { x: 0 } },
    from_right: { from: { x: 24 }, to: { x: 0 } },
    expand_center: { from: { scale: 0.8 }, to: { scale: 1 } },
    collapse_center: { from: { scale: 1 }, to: { scale: 0.8 } },
    opacity_only: { from: { opacity: 0 }, to: { opacity: 1 } },
  },
};
```

---

## The full vibe database

Each block: **`id`** (stable key), **user vibe**, **`triggerPhrases`**, **`cssVars`**, **`jsInstruction`**, **`motionHint`**, **`tailwindHint`**, **`component`**, **`patternsJson`** (suggested link).

**External URLs for this vibe** (keep in sync with `tone-vibes.json`): use the JSON as the source of truth for link lists; prose below stays implementation-focused.

---

### Magical

#### `magic.borderBeam`

**User says:** *“Energy running around the edge / glowing border / Magic UI border beam vibe.”*

**Trigger phrases:** energy running around the edge, glowing border that moves, light tracing the outline, feels like Magic UI border beam, animated border glow.

**CSS variables (tweak in theme):**

```css
--beam-speed: 6s;
--beam-color-from: #a855f7;
--beam-color-to: #3b82f6;
--beam-size: 120px;
--beam-opacity: 0.8;
```

**JS / CSS instruction:** pseudo-element or absolutely positioned layer; **linear** infinite motion along border path; conic/linear gradient + mask; duration ~**6000ms**; easing **linear** for endless trace.

**Motion hint:** animate `offsetDistance` on a `motion.div` (see [Magic UI border beam](https://magicui.design/docs/components/border-beam) for prop ideas: `duration`, `colorFrom`, `colorTo`, `size`).

**Tailwind hint:** mask + gradient + animation duration via arbitrary value or CSS var; avoid spinning the whole card content.

**Component:** Card, Button, Input (focus ring accent).

**`patterns.json`:** `hover-tap-micro` (accent) or extend with a custom id.

---

#### `magic.shimmer`

**User says:** *“Light passing through / holographic / gloss moving across.”*

**Trigger phrases:** light passing through, shiny sweep effect, like a holographic card, gloss moving across, premium loading feel.

**CSS variables:**

```css
--shimmer-width: 40%;
--shimmer-angle: 120deg;
--shimmer-color: rgba(255, 255, 255, 0.15);
--shimmer-duration: 2.2s;
```

**JS instruction:** translate a gradient overlay **-150% → 250%** on X; **2200ms**, `ease-in-out`, infinite; parent `overflow: hidden`.

**Motion hint:** `motion.span` with `animate={{ x: ["-150%", "250%"] }}` and `transition: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }` on overlay only.

**Tailwind hint:** `bg-gradient-to-r` + custom keyframes `shimmer`; use `@theme` / `@keyframes` in global CSS.

**Component:** Skeleton, Card, Button loading.

**`patterns.json`:** new id e.g. `shimmer-overlay` or `gradient-bg-motion`.

---

#### `magic.glow`

**User says:** *“Radiating warmth / soft halo / neon aura / lit from within.”*

**Trigger phrases:** radiating warmth, soft halo around it, glowing like it has power, neon aura, feels lit from within.

**CSS variables:**

```css
--glow-color: #a855f7;
--glow-spread: 20px;
--glow-opacity-min: 0.3;
--glow-opacity-max: 0.8;
--glow-duration: 2s;
```

**JS instruction:** pulse **box-shadow** or layered blur ring: 0% / 50% / 100% opacity spread; **~2000ms**, `ease-in-out`, infinite.

**Motion hint:** animate shadow via CSS variables Motion can tween if registered; otherwise CSS `@keyframes` on a wrapper.

**Component:** CTA Button, Badge, Icon, Featured card.

**`patterns.json`:** `gradient-bg-motion` (ambient) or custom `aura-pulse`.

---

### Natural

#### `natural.breathing`

**User says:** *“Feels alive / breathing / softly moving idle.”*

**Trigger phrases:** feels alive, like it's breathing, organic idle animation, gentle in and out, not static softly moving.

**CSS variables:**

```css
--breathe-scale-min: 1;
--breathe-scale-max: 1.03;
--breathe-opacity-min: 0.85;
--breathe-opacity-max: 1;
--breathe-duration: 3.5s;
```

**JS instruction:** keyframe **scale + opacity** loop; **3500ms**, `cubic-bezier(0.45, 0.05, 0.55, 0.95)`; `will-change: transform`.

**Motion hint:**

```tsx
animate={{ scale: [1, 1.03, 1], opacity: [0.85, 1, 0.85] }}
transition={{ duration: 3.5, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95] }}
```

**Component:** Avatar, status dot, hero image, soft CTA.

**`patterns.json`:** extend `natural` vibe or `enter-fade-up` for one-shot variant.

---

#### `natural.fluid`

**User says:** *“Like water / not robotic / flows.”*

**Trigger phrases:** smooth like water, not robotic or snappy, flows naturally, feels liquid, organic transition.

**JS instruction:** prefer **spring** or soft bezier `[0.25, 0.46, 0.45, 0.94]`; duration band **500–800ms** on layout props; avoid `linear` and `steps()` for organic UI.

**Motion hint:** `transition={{ type: "spring", stiffness: 60, damping: 15 }}` (example) for modals/drawers—tune stiffness up for snappier liquid.

**Component:** Modal, drawer, accordion, page transition.

**`patterns.json`:** `layout-shift` / custom `fluid-panel`.

---

#### `natural.drift`

**User says:** *“Gently floating / hovering / parallax-like idle.”*

**Trigger phrases:** gently floating, like it's hovering, soft idle movement, drifting in space, parallax-like idle.

**JS instruction:** slow **translateY + tiny rotate** loop **5–7s**, `ease-in-out`, infinite; jitter durations ±1s per element for organic ensemble.

**Motion hint:**

```tsx
animate={{ y: [0, -8, -4, 0], rotate: [0, 1, -0.5, 0] }}
transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
```

**Component:** Decorative blob, background shape, floating badge, hero illustration.

**`patterns.json`:** `grid-dots-pattern` companion or `natural-drift`.

---

### Reactive

#### `reactive.snap`

**User says:** *“Satisfying click / immediate / physical button.”*

**Trigger phrases:** satisfying click, feels physical, snappy response, like pressing a real button, immediate feedback.

**JS instruction:** on press: **scale 1 → 0.94 → 1** in **~150ms**, sharp bezier `[0.36, 0.07, 0.19, 0.97]`; total under **200ms**.

**Motion hint:**

```tsx
whileTap={{ scale: 0.94 }}
transition={{ type: "tween", duration: 0.15, ease: [0.36, 0.07, 0.19, 0.97] }}
```

**Component:** Button, icon button, toggle, checkbox.

**`patterns.json`:** `hover-tap-micro`.

---

#### `reactive.ripple`

**User says:** *“Ripple on click / material touch wave.”*

**Trigger phrases:** ripple on click, material design feel, energy spreading outward, touch wave effect, click radiates.

**JS instruction:** inject transient node at pointer coords; **scale 0→4**, **opacity 0.4→0** in **~600ms** `ease-out`; remove on finish.

**Motion hint:** spawn `motion.span` with `initial={{ scale: 0, opacity: 0.4 }}` `animate={{ scale: 4, opacity: 0 }}` or use CSS `@keyframes` from event coordinates.

**Component:** Button, list row, clickable card.

**`patterns.json`:** `hover-tap-micro` or custom `ripple-pointer`.

---

#### `reactive.bounce`

**User says:** *“Springy entrance / bounces in / elastic pop.”*

**Trigger phrases:** springy entrance, bounces in, feels playful when it appears, elastic pop, not a flat fade.

**JS instruction:** keyframe **scale 0.6 → 1.08 → 0.97 → 1.0**, opacity in; **~400ms**, overshoot bezier `[0.34, 1.56, 0.64, 1]`.

**Motion hint:**

```tsx
initial={{ scale: 0.6, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
transition={{ type: "spring", stiffness: 400, damping: 17 }}
```

**Component:** Modal, toast, tooltip, dropdown, new badge.

**`patterns.json`:** `stagger-children` friend for lists; entry pop custom id optional.

---

### Elegant

#### `elegant.silk`

**User says:** *“Expensive / Apple–Linear / refined, nothing jarring.”*

**Trigger phrases:** feels expensive, high-end transition, like Apple or Linear, refined and smooth, nothing jarring.

**JS instruction:** **opacity + translateY(6px max)**; **380ms** (sweet spot **300–450ms**); easing `[0.16, 1, 0.3, 1]`.

**Motion hint:**

```tsx
initial={{ opacity: 0, y: 6 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
```

**Component:** Section reveals, cards, modals.

**`patterns.json`:** `enter-fade-up`.

---

#### `elegant.glide`

**User says:** *“Slides in confidently / always belonged there.”*

**Trigger phrases:** slides in confidently, like it was always there, no drama just appears, smooth slide from side, panel glides in.

**JS instruction:** **translateX(-24px) + opacity** (flip sign if from right); **420ms**, `[0.22, 1, 0.36, 1]`; **stagger ~50ms** per child.

**Motion hint:** `staggerChildren: 0.05` on parent variants.

**Component:** Sidebar, drawer, nav, staggered list.

**`patterns.json`:** `stagger-children`, `scroll-in-view`.

---

#### `elegant.fade`

**User says:** *“Just fade / quiet / minimal.”*

**Trigger phrases:** just fades in, no movement needed, quiet appearance, subtle don't overdo it, minimal transition.

**JS instruction:** **opacity only** **250–350ms**, `ease`.

**Motion hint:** `initial={{ opacity: 0 }}` `animate={{ opacity: 1 }}` — no `y` unless user upgrades the brief.

**Component:** Overlay, tooltip, image load, background cross-fade.

**`patterns.json`:** `enter-fade-up` (opacity-only variant).

---

### Bold

#### `bold.slam`

**User says:** *“Hits hard / dramatic / makes a statement.”*

**Trigger phrases:** hits hard, dramatic entrance, slams into place, bold and confident, makes a statement.

**JS instruction:** start **larger**: scale **1.15**, **translateY(-20px)**, opacity 0 → snap down to **0.98** at 60% → settle **1.0**; **~320ms**, `[0.22, 1, 0.36, 1]`.

**Motion hint:** keyframes or three-stage tween; use sparingly (hero / modal).

**Component:** Hero heading, full-screen modal, alert banner.

**`patterns.json`:** custom `dramatic-enter` or reuse `enter-fade-up` with larger offsets.

---

#### `bold.burst`

**User says:** *“Explodes outward / shockwave / celebration.”*

**Trigger phrases:** explodes outward, radiates from center, burst of energy, like a shockwave, celebration effect.

**JS instruction:** **scale 0 → 1.4 → 2.0** with opacity falloff **~600ms** `ease-out`; layer **2–3** rings staggered **0 / 100 / 200ms**.

**Motion hint:** multiple `motion.span` with delayed `animate`.

**Component:** Success state, confetti-adjacent, achievement, like burst.

**`patterns.json`:** custom `celebration-burst`.

---

### Subtle

#### `subtle.whisper`

**User says:** *“Barely noticeable / ambient life.”*

**Trigger phrases:** barely noticeable, just a hint, ambient movement, don't distract the user, background life.

**JS instruction:** **opacity micro-pulse** ± optional **1px** `y`; **~4000ms** loop, `ease-in-out`.

**Motion hint:** deltas so small that if it’s obvious, dial down.

**Component:** Background decoration, idle icon, secondary text.

**`patterns.json`:** new `ambient-micro` or skip pattern for purely decorative.

---

#### `subtle.ghost`

**User says:** *“Materializes / no entrance drama.”*

**Trigger phrases:** appears silently, no entrance drama, like it materializes, fades in from nothing, disappears cleanly.

**JS instruction:** **opacity + blur(2px → 0)** **~200ms** `ease-out`.

**Motion hint:** animating blur is heavier—prefer opacity-only on low-end; gate blur behind `prefers-reduced-motion: no-preference`.

**Component:** Tooltip, context menu, inline hint, popover.

**`patterns.json`:** `enter-fade-up` (ghost variant).

---

### Precise

#### `precise.lock`

**User says:** *“Snaps into place / lock click / grid snap.”*

**Trigger phrases:** snaps into place, feels confirmed, like a lock clicking, decisive placement, grid snap feel.

**JS instruction:** move to target with **micro overshoot**: land at **target − 4px**, then **target + 1px**, then **target**; **~180ms**, sharp bezier.

**Motion hint:** `type: "spring", stiffness: 700, damping: 32` can approximate settle.

**Component:** Drag-and-drop, sortable list, validation snap, toggle.

**`patterns.json`:** custom `snap-settle`.

---

#### `precise.confirm`

**User says:** *“Quick nod that it worked / success flash.”*

**Trigger phrases:** quick success flash, visual nod, confirms the action, green flash moment, checkmark feel.

**JS instruction:** short **color + scale** sequence: default → success at **80ms** (`scale(1.05)`) → back by **300ms** total.

**Motion hint:** `animate` sequence with `keyframes` or chained `animate()` from Motion 11+ if available; else timeline.

**Component:** Submit, copy, save, field success.

**`patterns.json`:** `hover-tap-micro` + semantic color token.

---

## Quick-reference lookup

| User says (gist) | Library `id` | Duration | Easing / type | Primary property |
|------------------|--------------|----------|---------------|-------------------|
| feels alive / breathing | `natural.breathing` | ~3500ms | soft ease / loop | scale + opacity |
| light tracing border | `magic.borderBeam` | ~6000ms | linear ∞ | masked gradient / offset path |
| premium / Apple-like | `elegant.silk` | ~380ms | expo-out bezier | opacity + small `y` |
| satisfying click | `reactive.snap` | ~150ms | sharp bezier | `whileTap` scale |
| springy entrance | `reactive.bounce` | ~400ms | overshoot / spring | scale + opacity |
| barely noticeable | `subtle.whisper` | ~4000ms | ease-in-out loop | opacity ±1px |
| slams into place | `bold.slam` | ~320ms | fast expo | scale + `y` drama |
| light sweep / shimmer | `magic.shimmer` | ~2200ms | ease-in-out | translateX overlay |
| lock / snap confirm | `precise.lock` | ~180ms | sharp | micro overshoot |
| floats / drifts | `natural.drift` | ~5–7s | ease-in-out loop | `y` + tiny `rotate` |
| glows / aura | `magic.glow` | ~2000ms | ease-in-out loop | shadow / ring |
| ripple on click | `reactive.ripple` | ~600ms | ease-out | expanding circle |
| materialize silent | `subtle.ghost` | ~200ms | ease-out | opacity + blur |
| slides in confident | `elegant.glide` | ~420ms | expo-out | `x` + opacity + stagger |
| explosion / celebrate | `bold.burst` | ~600ms | ease-out | scale out + fade |

---

## Reactive without chaos (guardrails)

- **One hero motion** per viewport: text *or* background drift, not both screaming.  
- **Input feedback** stays under **~200ms** for press; use `reactive.snap`.  
- **Scroll:** `whileInView` + `once: true` so sections don’t re-animate on every scroll nudge.

---

## When the brief is still mush — ask two questions

1. **Calm or snappy?** (section enter under 0.35s vs 0.5s+)  
2. **Subtle or expressive?** (small translate vs big translate / rotation / burst)

Map answers to **`TRANSLATION_RULES.intensity`** + speed row.

---

## Paste block for Cursor / vibe prompts

```text
If the user describes motion only with mood words:
1) Load docs/animation-reference/tone-vibes.json — match triggerPhrases / feelingKeywords to vibe id(s).
2) Open externalRefs URLs for those vibes (Motion, Magic UI, React Bits, Animate UI, Kokonut, CuiCui, anime.js, GSAP as listed).
3) Implement with motion/react using tone-to-motion.md numbers; galleries are reference-only.
4) Respect prefers-reduced-motion; note patterns.json ids from tone-vibes patternsJson.
```

---

## Link to `patterns.json`

Vibes are **creative**; patterns are **structural**. Always cross-link: e.g. `elegant.silk` → `enter-fade-up`, `reactive.snap` → `hover-tap-micro`, `elegant.glide` + scroll → `scroll-in-view`.

---

## Key takeaway

**Feeling words are not ambiguous to the system if you fix this pipeline:** phrase → **vibe `id`** → **numbers** (`TRANSLATION_RULES`) → **Motion/CSS** → **`patterns.json` id**. The `triggerPhrases` on each entry exist so a future picker / fuzzy matcher / LLM can jump to the right row without the user naming “border beam.”
