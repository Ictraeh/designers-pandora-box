# React Bits

- **Site:** [reactbits.dev](https://reactbits.dev/)
- **Role:** Browse animated React UI patterns; use as **vocabulary** (“split text”, “aurora”, “card tilt”) then map to your patterns.

## How to use with this reference

1. Open the site and pick a category (text, components, backgrounds, etc.).
2. Map the idea to a row in `../patterns.json` (e.g. text reveal → `text-reveal`, scroll → `scroll-in-view`).
3. Implement with **Motion first** ([../motion.md](../motion.md)); add GSAP only if you need timeline/scrub complexity ([../gsap.md](../gsap.md)).

## URL note

React Bits is largely **client-rendered**; deep URLs may vary. Start from the homepage and use the site search / nav. Prefer **describing the effect** in prompts rather than hard-coding fragile URLs.

## Suggested pattern mapping (examples)

| Typical React Bits vibe | `patterns.json` id |
|-------------------------|-------------------|
| Text scramble / decode | `text-reveal` (or extend with a new id) |
| Card hover tilt | `hover-tap-micro` |
| Background grain / gradient | `gradient-bg-motion`, `grid-dots-pattern` |
| Scroll section reveals | `scroll-in-view` |
