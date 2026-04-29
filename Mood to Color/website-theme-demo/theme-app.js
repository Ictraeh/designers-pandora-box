/**
 * Website theme demo — loads same Mindful + Pinterest data as ../demo/, scores with mood-engine-v2,
 * then builds Material-style roles via theme-pipeline.js.
 */
(function () {
  const DATA_BASE = "../demo/data/";
  const MAX_THEME_PALETTE_ROWS = 96;
  const SCORE_YIELD_INTERVAL = 120;

  const {
    normalizeHex,
    analyzePalette,
    buildUnifiedPaletteList,
    dedupeRowsByPaletteSimilarity,
    intraPaletteTooRedundant,
    paletteSource,
  } = window.MoodThemePalette;
  const PALETTE_NEAR_DUPLICATE_SIMILARITY = 0.86;

  let paletteBundle = null;
  let selectedChipId = null;
  let buildGeneration = 0;

  async function ensurePalettes() {
    if (paletteBundle) return paletteBundle;
    const [mRes, pRes] = await Promise.all([
      fetch(`${DATA_BASE}mindful-palettes.json`),
      fetch(`${DATA_BASE}pinterest-colors.json`),
    ]);
    if (!mRes.ok) throw new Error(`Could not load mindful-palettes.json (${mRes.status})`);
    const mindful = await mRes.json();
    let pinterest = { palettes_by_image: [] };
    let pinterestFetchOk = pRes.ok;
    if (pRes.ok) {
      try {
        pinterest = await pRes.json();
      } catch {
        pinterest = { palettes_by_image: [] };
        pinterestFetchOk = false;
      }
    }
    const list = buildUnifiedPaletteList(mindful, pinterest);
    paletteBundle = { mindful, pinterest, list, pinterestFetchOk };
    return paletteBundle;
  }

  function aggregateTarget(chipId, extraText) {
    const chip = chipId ? window.MOOD_CHIPS.find((c) => c.id === chipId) : null;
    const extraLemmas = extraText
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((t) => t.length > 1);
    if (!chip) return null;
    const lemmas = [...new Set([...chip.lemmas, ...extraLemmas])];
    return { moodId: chip.id, lemmas };
  }

  function renderChips(container, chipId, onPick) {
    container.innerHTML = "";
    for (const c of window.MOOD_CHIPS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.id = c.id;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", c.id === chipId ? "true" : "false");
      b.innerHTML = `<span>${c.label}</span><span class="detail">${c.detail}</span>`;
      b.addEventListener("click", () => {
        const next = c.id === chipId ? null : c.id;
        onPick(next);
      });
      container.appendChild(b);
    }
  }

  function roleCard(title, hex, subtitle) {
    return `<div class="role-card" style="--sw:${hex}">
      <div class="role-swatch"></div>
      <div class="role-meta"><strong>${title}</strong><code>${hex}</code><span class="sub">${subtitle || ""}</span></div>
    </div>`;
  }

  function renderTheme(container, theme) {
    const m = theme.material;
    const acc = theme.accessibility;
    const rows = [
      ["Primary", m.primary, m.onPrimary, acc.primaryContrast],
      ["Secondary", m.secondary, m.onSecondary, acc.secondaryContrast],
      ["Tertiary", m.tertiary, m.onTertiary, acc.tertiaryContrast],
      ["Supplementary", m.supplementary, m.onSupplementary, acc.supplementaryContrast],
      ["Background", m.background, m.onBackground, acc.backgroundContrast],
      ["Surface", m.surface, m.onSurface, acc.surfaceContrast],
    ];
    let html = '<div class="theme-grid">';
    for (const [label, bg, on, cr] of rows) {
      html += `<div class="token-row" style="background:${bg};color:${on}">
        <span class="tok-label">${label}</span><code>${bg}</code><span class="tok-on">on: ${on}</span>
        <span class="tok-cr">${cr.toFixed(2)}:1</span></div>`;
    }
    html += "</div>";
    html += '<div class="role-row">' + roleCard("Primary", m.primary, theme.usage.primary) + roleCard("Secondary", m.secondary, theme.usage.secondary) + roleCard("Tertiary", m.tertiary, theme.usage.tertiary) + roleCard("Supplementary", m.supplementary, theme.usage.supplementary) + "</div>";
    html += '<div class="variant-row"><span>Variants</span><code>primaryVariant: ' + m.primaryVariant + "</code><code>secondaryVariant: " + m.secondaryVariant + "</code></div>";
    html += '<ul class="why-list">';
    for (const w of theme.why) html += `<li>${w}</li>`;
    html += "</ul>";
    html +=
      '<button type="button" class="copy-css" id="copy-theme-css">Copy CSS variables</button> <span class="hint">' +
      theme.sourcePaletteCount +
      " palettes in theme pool · " +
      theme.candidateColorCount +
      " candidate swatches</span>";
    container.innerHTML = html;
    const css = `:root {
  --color-primary: ${m.primary};
  --color-on-primary: ${m.onPrimary};
  --color-primary-variant: ${m.primaryVariant};
  --color-secondary: ${m.secondary};
  --color-on-secondary: ${m.onSecondary};
  --color-secondary-variant: ${m.secondaryVariant};
  --color-tertiary: ${m.tertiary};
  --color-on-tertiary: ${m.onTertiary};
  --color-supplementary: ${m.supplementary};
  --color-on-supplementary: ${m.onSupplementary};
  --color-background: ${m.background};
  --color-on-background: ${m.onBackground};
  --color-surface: ${m.surface};
  --color-on-surface: ${m.onSurface};
  --color-error: ${m.error};
  --color-on-error: ${m.onError};
}`;
    document.getElementById("copy-theme-css").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(css);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = css;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      const t = document.getElementById("copy-toast");
      if (t) {
        t.textContent = "Copied CSS variables";
        t.classList.add("copy-toast--visible");
        setTimeout(() => t.classList.remove("copy-toast--visible"), 1600);
      }
    });
  }

  async function runBuild() {
    const gen = ++buildGeneration;
    const chipsEl = document.getElementById("chips");
    const extraEl = document.getElementById("extra");
    const outEl = document.getElementById("theme-out");
    const statusEl = document.getElementById("status");
    const errEl = document.getElementById("err");

    const target = aggregateTarget(selectedChipId, extraEl.value || "");
    if (!target) {
      outEl.innerHTML = '<p class="empty">Select a mood to build a website theme.</p>';
      statusEl.textContent = paletteBundle ? "Pick a mood tag." : "";
      return;
    }
    errEl.hidden = true;
    statusEl.textContent = "Loading / scoring palettes…";
    try {
      const bundle = await ensurePalettes();
      if (gen !== buildGeneration) return;
      const list = bundle.list || [];
      const rows = [];
      let maxScore = 0;
      let skippedIntra = 0;
      const nList = list.length;
      for (let i = 0; i < nList; i++) {
        const p = list[i];
        const hexes = (p.colors || []).map((c) => normalizeHex(c.hex)).filter(Boolean);
        if (hexes.length < 4) continue;
        let pal = p.__cachedPal;
        if (pal === undefined) {
          if (intraPaletteTooRedundant(hexes)) {
            p.__cachedPal = false;
            skippedIntra++;
            continue;
          }
          const analyzed = analyzePalette(hexes);
          if (!analyzed) {
            p.__cachedPal = false;
            continue;
          }
          p.__cachedPal = analyzed;
          pal = analyzed;
        } else if (!pal) continue;
        const summary = (p.paletteSummary || "").toLowerCase();
        const s = window.scoreMoodDirectional(pal, target.moodId, target.lemmas, summary);
        maxScore = Math.max(maxScore, s);
        rows.push({ score: s, p, pal });
        if (rows.length % SCORE_YIELD_INTERVAL === 0) {
          if (gen !== buildGeneration) return;
          statusEl.textContent = `Scoring… ${i + 1} / ${nList}`;
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      rows.sort((a, b) => b.score - a.score);
      let shown = [];
      if (maxScore > 0) {
        const absMin = ABS_MIN_BY_MOOD[target.moodId] ?? ABS_MIN_BY_MOOD.default;
        const maxMindful = rows.reduce((m, r) => (paletteSource(r.p) !== "pinterest" ? Math.max(m, r.score) : m), 0);
        const maxPinterest = rows.reduce((m, r) => (paletteSource(r.p) === "pinterest" ? Math.max(m, r.score) : m), 0);
        shown = rows.filter((r) => {
          const src = paletteSource(r.p);
          const localTop = src === "pinterest" ? maxPinterest : maxMindful;
          const relativePass =
            localTop <= 0 ? r.score / maxScore >= MIN_SCORE_REL_TO_TOP : r.score >= MIN_SCORE_REL_TO_TOP * localTop;
          return relativePass && r.score >= absMin;
        });
        shown.sort((a, b) => b.score - a.score);
        shown = dedupeRowsByPaletteSimilarity(shown, PALETTE_NEAR_DUPLICATE_SIMILARITY);
        shown = shown.slice(0, MAX_THEME_PALETTE_ROWS);
      }
      if (gen !== buildGeneration) return;
      if (!shown.length) {
        outEl.innerHTML = "<p class=\"empty\">No palettes passed the mood filter. Try another mood.</p>";
        statusEl.textContent = "No data.";
        return;
      }
      statusEl.textContent = "Building website roles (OKLab pool + greedy selection)…";
      await new Promise((r) => setTimeout(r, 0));
      const theme = window.MoodWebsiteTheme.buildMoodWebsiteTheme(shown, target.moodId, {
        minPaletteDistance: 0.082,
        poolPaletteLimit: 28,
      });
      if (gen !== buildGeneration) return;
      renderTheme(outEl, theme);
      statusEl.textContent = `Theme ready for “${target.moodId}”. ${shown.length} mood-filtered palettes → ${theme.sourcePaletteCount} after perceptual dedupe.`;
    } catch (e) {
      if (gen !== buildGeneration) return;
      errEl.hidden = false;
      errEl.textContent = String(e.message || e);
      outEl.innerHTML = "";
      statusEl.textContent = "";
    }
  }

  function debounce(fn, ms) {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function main() {
    const chipsEl = document.getElementById("chips");
    const extraEl = document.getElementById("extra");
    const outEl = document.getElementById("theme-out");
    const statusEl = document.getElementById("status");
    const errEl = document.getElementById("err");

    if (typeof window.scoreMoodDirectional !== "function") {
      errEl.hidden = false;
      errEl.textContent = "Missing mood-engine-v2.js";
      return;
    }

    function redraw() {
      renderChips(chipsEl, selectedChipId, (next) => {
        selectedChipId = next;
        redraw();
        void runBuild();
      });
    }
    redraw();
    extraEl.addEventListener("input", debounce(() => selectedChipId && void runBuild(), 320));

    outEl.innerHTML = '<p class="empty">Select a mood for a cohesive website color system.</p>';
    statusEl.textContent = "Loading library…";
    ensurePalettes()
      .then(() => {
        errEl.hidden = true;
        statusEl.textContent = "Pick a mood — theme uses the same Pinterest + Mindful library as the palette demo.";
      })
      .catch((e) => {
        errEl.hidden = false;
        errEl.textContent = String(e.message || e);
        statusEl.textContent = "Failed to load data. Serve from the Mood to Color folder (see README).";
      });
  }

  main();
})();
