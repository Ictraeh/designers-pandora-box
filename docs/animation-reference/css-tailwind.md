# CSS + Tailwind (lightweight path)

## When CSS is enough

- Color / opacity / transform on hover (with `@media (hover: hover)` when needed)
- Simple `@keyframes` for decorative backgrounds
- `transition-*` utilities on buttons and cards

## Tailwind v4 / v3 patterns

- Extend `theme.keyframes` and `theme.animation` for reusable named animations.
- Use **CSS variables** for duration and easing so one knob updates many utilities:

```css
:root {
  --motion-duration: 300ms;
  --motion-ease: cubic-bezier(0.16, 1, 0.3, 1);
}
```

```html
<div class="transition-[transform,opacity] duration-[var(--motion-duration)] ease-[var(--motion-ease)]" />
```

(Exact arbitrary syntax depends on your Tailwind version; keep tokens in one place.)

## Performance

- Prefer `transform` and `opacity`.
- Use `will-change` sparingly and remove after animation if possible.

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Scope this globally with care; often better to gate per component in JS (Motion/GSAP) for finer control.
