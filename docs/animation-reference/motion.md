# Motion for React (default engine)

**Docs:** [Motion for React — get started](https://motion.dev/docs/react)

## When to prefer Motion

- React state-driven UI: enter/exit, lists, modals, tabs
- Gestures: hover, tap, drag (better than CSS-only on touch)
- Layout animations (`layout`, `layoutId`)
- Scroll: `whileInView`, `useScroll`, `useTransform`
- SVG: `pathLength`, attribute animation

## Install (current package name)

```bash
npm install motion
```

```tsx
import { motion } from "motion/react";
```

## Core props (cheat sheet)

| Prop | Role |
|------|------|
| `initial` | Starting state (or `false` to skip) |
| `animate` | Target state when mounted / deps change |
| `exit` | Used inside `AnimatePresence` |
| `whileHover` / `whileTap` | Gestures |
| `whileInView` | Scroll-triggered |
| `transition` | duration, ease, spring, staggerChildren |
| `layout` / `layoutId` | Shared / FLIP-style layout |

## Tailwind-friendly habit

Wrap motion targets and expose tokens:

```tsx
<motion.div
  className="will-change-transform"
  style={{ "--motion-dur": "0.45s" } as React.CSSProperties}
/>
```

Prefer **transform + opacity** for performance; avoid animating `box-shadow` blur heavily on large areas.

## Reduced motion

Use `useReducedMotion` from Motion and shorten or disable nonessential motion.

## AI context

Motion publishes examples and editor integrations — see the [Motion docs](https://motion.dev/docs/react) “Studio / MCP” sections for up-to-date links.
