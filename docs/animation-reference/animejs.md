# anime.js

**Docs:** [anime.js — animation](https://animejs.com/documentation/animation/)

## Good fits

- Imperative timelines on DOM or SVG without React wrapping every node
- Small landing sections where you already have refs to elements
- Prototyping motion outside React component trees

## React habit

- Create animations in `useLayoutEffect` / `useEffect` with proper cleanup (`animation.pause()` / cancel).
- Avoid fighting React: prefer Motion for state-bound UI; use anime.js when imperative control is clearer.

## Tailwind-friendly habit

Animate `translateX` / `opacity` on elements that already use utility classes; avoid inline styles that duplicate layout utilities unless necessary.

## Reduced motion

Check `window.matchMedia('(prefers-reduced-motion: reduce)')` before building timelines; shorten or skip.
