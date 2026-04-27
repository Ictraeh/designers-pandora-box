# Designer’s pandora box (workspace)

This folder is a **local workspace** that holds several separate Git projects. This **root repository** only tracks shared documentation:

- **`docs/animation-reference/`** — Motion / GSAP / anime.js notes, `tone-vibes.json`, gallery indexes, prompt workflow.

Other directories (ChopShop, agency-toolbox `landing page/`, `vibe-reference-ui/`, etc.) are **their own Git repositories** with their own remotes; they are listed in `.gitignore` here so this root repo stays small and conflict-free.

## Related repos

- **Vibe browser UI:** [github.com/Ictraeh/vibe-reference-ui](https://github.com/Ictraeh/vibe-reference-ui) — includes a bundled copy of `docs/animation-reference/` for deployable search UI.

## Syncing docs into the UI repo

After editing files under `docs/animation-reference/` here:

```bash
cp -R "docs/animation-reference/"* "vibe-reference-ui/docs/animation-reference/"
```

Then commit and push inside `vibe-reference-ui/`.
