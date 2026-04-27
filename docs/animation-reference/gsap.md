# GSAP (power path)

**Docs:** [GSAP documentation](https://gsap.com/docs/v3/) · [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)

## When to reach for GSAP

- Pin + scrub timelines tied to scroll
- Complex multi-track sequences with fine control
- Plugins: DrawSVG, SplitText (where licensed), MotionPath, etc.
- Non-React or mixed DOM orchestration

## When *not* to default to GSAP

- Simple enters, hovers, and list staggers → [Motion](./motion.md) is usually less glue in React
- Bundle size: load GSAP only on routes/components that need it

## React integration

Use `@gsap/react` patterns from official GSAP React guides; clean up ScrollTrigger instances on unmount.

## Tailwind-friendly habit

Drive tweens from CSS variables GSAP reads/writes (`gsap.to(el, { "--x": 100 })`) so Tailwind classes stay on structure.

## Reduced motion

Respect `prefers-reduced-motion`: skip pin/scrub theatrics or replace with simple fades.
