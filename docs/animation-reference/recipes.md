# Minimal recipes (first-party)

Short patterns for your own codebase. Tune `duration`, `ease`, and respect reduced motion in production.

## 1. Fade up on enter (Motion)

```tsx
import { motion } from "motion/react";

export function FadeUp({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
```

## 2. Scroll reveal once (Motion)

```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-80px" }}
  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
>
  {/* content */}
</motion.div>
```

## 3. Stagger children (Motion)

```tsx
const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map((x) => (
    <motion.li key={x} variants={item}>
      {x}
    </motion.li>
  ))}
</motion.ul>
```

## 4. Button hover / tap (Motion)

```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400, damping: 22 }}
  className="rounded-full px-5 py-2"
>
  Action
</motion.button>
```

## 5. CSS variable knob (works with Tailwind)

```tsx
export function MotionSurface({
  children,
  duration = 0.45,
}: {
  children: React.ReactNode;
  duration?: number;
}) {
  return (
    <div style={{ "--motion-dur": `${duration}s` } as React.CSSProperties}>
      {children}
    </div>
  );
}
```

Pair with utilities that reference `var(--motion-dur)` for non-Motion layers.

## Reduced motion (sketch)

```tsx
import { useReducedMotion } from "motion/react";

const reduce = useReducedMotion();
const y = reduce ? 0 : 12;
```

Use `y: 0` and shorter `duration` when `reduce` is true.
