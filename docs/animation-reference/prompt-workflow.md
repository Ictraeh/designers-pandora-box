# Using animation reference in the website-making prompt process

This folder is a **sidecar to your main build prompt**: it tells the model *which motion vocabulary to use*, *which engine*, and *where to look*, without pasting whole third-party components into the chat.

## 1. Attach context (Cursor)

In each vibe-coding session where you want motion consistency:

- Use **@** and add files or folders, for example:
  - `@docs/animation-reference/prompt-workflow.md` (this file)
  - `@docs/animation-reference/patterns.json`
  - `@docs/animation-reference/recipes.md`
  - `@docs/animation-reference/motion.md`
  - `@docs/animation-reference/tone-to-motion.md` — when users only give **mood words** (natural, reactive, elegant)
  - `@docs/animation-reference/tone-vibes.json` — **fuzzy phrase → vibe id → URLs** (Motion, Magic UI, React Bits, anime.js, GSAP, …)
  - Optionally `@docs/animation-reference/sources/magic-ui.md` (or whichever gallery matches the “look” you want)

Attaching the whole `docs/animation-reference/` folder is fine if the model budget allows it.

## 2. Order of operations in *your* prompt

Write prompts in this order:

1. **Product / page goal** (what the site is, stack: Next, Tailwind, etc.).
2. **Visual direction** (brand, spacing, typography) — your normal prompt.
3. **Motion block** (short, always similar):
   - “Use Motion (`motion/react`) for UI motion unless I say otherwise.”
   - “If the user only describes **tone** (natural, reactive, elegant…), translate with `tone-to-motion.md` into explicit `transition` / spring / max `y` / stagger — do not leave motion implicit.”
   - “Follow `patterns.json`: name the pattern ids you use in a short comment or README section.”
   - “For ‘vibes’ named after Magic UI / React Bits / etc., only **reimplement**; use `sources/*.md` for doc URLs and props ideas, do not paste their full source unless license allows.”
   - “Respect `prefers-reduced-motion`; keep hero motion tasteful.”
4. **Concrete asks** (e.g. “hero: scroll-in-view headline + staggered subpoints”).

That way motion rules do not drown out layout/content, but they are binding.

## 3. Map “I want it to feel like X” → reference

| You say | Model should do |
|---------|------------------|
| “Like Magic UI border beam” | Open [sources/magic-ui.md](./sources/magic-ui.md) → [border-beam doc](https://magicui.design/docs/components/border-beam) for *idea + props* → implement with Motion/CSS in **your** components; map to patterns like `hover-tap-micro` / new id. |
| “Like React Bits text stuff” | [sources/react-bits.md](./sources/react-bits.md) + [patterns.json](./patterns.json) `text-reveal` / related. |
| “Shadcn-style but animated” | [sources/animate-ui.md](./sources/animate-ui.md) + [recipes.md](./recipes.md). |
| “Kokonut-style button” | [sources/kokonut-ui.md](./sources/kokonut-ui.md) + `particle-button` doc for behavior keywords → your button. |
| “CuiCui magnetic button” | [sources/cuicui.md](./sources/cuicui.md) → [buttons hub](https://cuicui.day/common-ui/buttons) → describe behavior; implement with Motion. |

## 4. Copy-paste prompt snippets

**Minimal motion guardrails**

```text
Motion: use `motion/react`. Prefer transform/opacity. Respect prefers-reduced-motion.
When referencing React Bits / Magic UI / Animate UI / Kokonut / CuiCui, treat them as design references only—reimplement in our codebase. Use docs in docs/animation-reference/ for pattern ids and recipes.
```

**Tighter (name files)**

```text
@docs/animation-reference/patterns.json @docs/animation-reference/recipes.md @docs/animation-reference/motion.md

Implement [FEATURE]. Pick pattern ids from patterns.json and note them in code comments. Start from recipes.md for structure.
```

**Gallery-led vibe**

```text
@docs/animation-reference/sources/magic-ui.md @docs/animation-reference/patterns.json

Visual reference: Magic UI [border-beam / blur-fade / …]. Match the *feel* (speed, color, once-on-scroll) with our tokens; do not copy vendor source wholesale.
```

## 5. Optional: your separate “website prompt generator”

If you use an external or internal **prompt generator** (e.g. industry + stack + motion):

- Add a **fixed appendix** field: “Append the contents of `docs/animation-reference/README.md` + `patterns.json`” or a shortened checklist derived from this file.
- Or store one **master string** in the generator: the “Minimal motion guardrails” block above plus one line: “Gallery index: `docs/animation-reference/sources/README.md`.”

## 6. After the model outputs code

Quick review:

- [ ] Uses Motion (or the engine the pattern allowed) consistently  
- [ ] No huge pasted blocks from Magic UI/React Bits without license path  
- [ ] Reduced motion path exists for nonessential animation  
- [ ] Performance: no massive blur/shadow animation on full viewport  

## 7. Evolving the system

When you reuse the same vibe often, add a **new row** to `patterns.json` (new `id`, `tags`, `docs`) and, if useful, one paragraph in `sources/`—so the next prompt can say “use pattern `xyz`” in one line.
