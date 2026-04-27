# CuiCui

- **Hub:** [cuicui.day](https://cuicui.day/)
- **Common UI category:** [cuicui.day/common-ui](https://cuicui.day/common-ui)

## URL pattern (category listings)

`https://cuicui.day/common-ui/{category}`

Examples:

| Category | Listing page |
|----------|----------------|
| Buttons | [common-ui/buttons](https://cuicui.day/common-ui/buttons) |
| (see hub) | Avatars, badges, cards, inputs, loaders, navigation, skeletons, toggles — from [common-ui](https://cuicui.day/common-ui) |

Each listing page documents **named variants** (e.g. magnetic button, shiny rotating border). Use those names in prompts; implementation details live behind “Preview / Code” on their site or on [GitHub](https://github.com/damien-schneider/cuicui).

## How to use with this reference

1. Pick a category hub above.
2. Map the variant to `../patterns.json` (usually `hover-tap-micro`, `enter-fade-up`, or extend the JSON with a new id).
3. Prefer Motion + CSS in your own codebase ([../motion.md](../motion.md), [../css-tailwind.md](../css-tailwind.md)).

## Pattern mapping

| CuiCui focus | `patterns.json` categories |
|--------------|----------------------------|
| Button motion | `interaction`, `elements` |
| Loaders | `elements` |
| Cards / nav | `elements`, `interaction` |
