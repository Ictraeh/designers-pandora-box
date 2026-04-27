# Animate UI

- **Introduction:** [animate-ui.com/docs](https://animate-ui.com/docs)
- **Components hub:** [animate-ui.com/docs/components](https://animate-ui.com/docs/components)
- **Primitives:** [animate-ui.com/docs/primitives](https://animate-ui.com/docs/primitives)
- **Stack:** Tailwind CSS + [Motion](https://motion.dev/docs/react); copy-first distribution (similar mindset to shadcn/ui). [GitHub](https://github.com/imskyleen/animate-ui)

## Structure (for mapping prompts)

| Section | Use for |
|---------|---------|
| **Animate UI** (own) | Opinionated animated building blocks |
| **Radix / Base / Headless** | Accessible primitives with motion layered on top |
| **Effects / Buttons / Texts** | Direct alignment with `patterns.json` categories |

## How to use with this reference

1. Start from [Components](https://animate-ui.com/docs/components) or [Primitives](https://animate-ui.com/docs/primitives).
2. Prefer exporting **your** variant using knobs from [../recipes.md](../recipes.md) (duration, spring, `whileInView`).
3. Icons: follow Animate UI’s animated Lucide patterns; keep icon motion subtle for a11y.

## Pattern mapping

| Animate UI area | `patterns.json` categories |
|-----------------|----------------------------|
| Texts | `text` |
| Buttons | `elements`, `interaction` |
| Backgrounds | `backgrounds` |
| Primitives | foundation for all categories |
