/**
 * Website theme demo — loads same Mindful + Pinterest data as ../demo/, scores with mood-engine-v2,
 * then builds Material-style roles via theme-pipeline.js.
 */
(function () {
  const DATA_BASE = "../demo/data/";
  const MAX_THEME_PALETTE_ROWS = 96;
  const SCORE_YIELD_INTERVAL = 120;
  /** Bump when scoring, stratify, or fingerprint logic changes so stale sessionStorage is ignored. */
  const THEME_CACHE_SCHEMA = 22;
  const SCORE_CACHE_INTRA = "__intra__";
  const SCORE_CACHE_BAD = "__bad__";

  /** Same inputs as scoreMoodDirectional: mood id + sorted lemma list from chips + extra words. */
  function moodScoreIdentity(target) {
    return JSON.stringify({ m: target.moodId, l: [...target.lemmas].sort() });
  }

  function hashKeyPart(identityStr, fp) {
    let h = 5381;
    const str = `${THEME_CACHE_SCHEMA}|${identityStr}|${fp}`;
    for (let i = 0; i < str.length; i++) h = (h << 5) + h + str.charCodeAt(i);
    return (h >>> 0).toString(36);
  }

  function themeCacheHashPart(identityStr, fp, mode, tone) {
    let h = 5381;
    const str = `${THEME_CACHE_SCHEMA}|m:${mode}|t:${tone}|${identityStr}|${fp}`;
    for (let i = 0; i < str.length; i++) h = (h << 5) + h + str.charCodeAt(i);
    return (h >>> 0).toString(36);
  }

  function paletteStableKey(p) {
    const ps = window.MoodThemePalette.paletteSource;
    return `${ps(p)}:${p.paletteNumber}`;
  }

  function dataFingerprint(list) {
    const { normalizeHex: nh, paletteSource: ps } = window.MoodThemePalette;
    if (!list || !list.length) return "0";
    let nMind = 0;
    const parts = [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (ps(p) !== "pinterest") nMind++;
      if (i < 2 || i >= list.length - 2) {
        const hx = (p.colors || [])
          .map((c) => nh(c.hex))
          .filter(Boolean)
          .sort()
          .join(",");
        parts.push(`${ps(p)}:${p.paletteNumber}:${hx}`);
      }
    }
    return `${list.length}|${nMind}|${parts.join(";")}`;
  }

  function scoreMapCoversList(list, scoreMap) {
    const nh = window.MoodThemePalette.normalizeHex;
    if (!scoreMap || typeof scoreMap !== "object") return false;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const hexes = (p.colors || []).map((c) => nh(c.hex)).filter(Boolean);
      if (hexes.length < 4) continue;
      if (!Object.prototype.hasOwnProperty.call(scoreMap, paletteStableKey(p))) return false;
    }
    return true;
  }

  function loadScoreCache(identityStr, fp) {
    try {
      const raw = sessionStorage.getItem(`mtScores_${hashKeyPart(identityStr, fp)}`);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || o.v !== THEME_CACHE_SCHEMA || o.fp !== fp || o.identityStr !== identityStr) return null;
      return o.scores;
    } catch {
      return null;
    }
  }

  function saveScoreCache(identityStr, fp, scores) {
    try {
      sessionStorage.setItem(
        `mtScores_${hashKeyPart(identityStr, fp)}`,
        JSON.stringify({ v: THEME_CACHE_SCHEMA, fp, identityStr, scores }),
      );
    } catch (_) {}
  }

  function loadThemeCache(identityStr, fp, mode, tone) {
    try {
      const raw = sessionStorage.getItem(`mtTheme_${themeCacheHashPart(identityStr, fp, mode, tone)}`);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || o.v !== THEME_CACHE_SCHEMA || o.fp !== fp || o.identityStr !== identityStr) return null;
      if (o.mode !== mode || o.tone !== tone) return null;
      return o;
    } catch {
      return null;
    }
  }

  function saveThemeCache(identityStr, fp, theme, statusText, mode, tone) {
    try {
      sessionStorage.setItem(
        `mtTheme_${themeCacheHashPart(identityStr, fp, mode, tone)}`,
        JSON.stringify({ v: THEME_CACHE_SCHEMA, fp, identityStr, mode, tone, theme, statusText }),
      );
    } catch (_) {}
  }

  const {
    normalizeHex,
    analyzePalette,
    buildUnifiedPaletteList,
    dedupeRowsByPaletteSimilarity,
    intraPaletteUnusableForWeb,
    paletteSource,
  } = window.MoodThemePalette;
  const PALETTE_NEAR_DUPLICATE_SIMILARITY = 0.86;

  let paletteBundle = null;
  let selectedChipId = null;
  let buildGeneration = 0;

  async function ensurePalettes() {
    if (paletteBundle) return paletteBundle;
    const [mRes, pRes, sRes] = await Promise.all([
      fetch(`${DATA_BASE}mindful-palettes.json`),
      fetch(`${DATA_BASE}pinterest-colors.json`),
      fetch(`${DATA_BASE}palette-pool-supplement.json`),
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
    let supplement = null;
    if (sRes.ok) {
      try {
        supplement = await sRes.json();
      } catch {
        supplement = null;
      }
    }
    const list = buildUnifiedPaletteList(mindful, pinterest, supplement);
    paletteBundle = { mindful, pinterest, supplement, list, pinterestFetchOk };
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

  function buildThemeCssExport(theme) {
    const m = theme.material;
    const fe = theme.frontend;
    const cv = fe && fe.cssVariables ? { ...fe.cssVariables } : {};
    cv["--color-on-primary"] = m.onPrimary;
    cv["--color-primary-variant"] = m.primaryVariant;
    cv["--color-on-secondary"] = m.onSecondary;
    cv["--color-secondary-variant"] = m.secondaryVariant;
    cv["--color-on-tertiary"] = m.onTertiary;
    cv["--color-on-supplementary"] = m.onSupplementary;
    cv["--color-background"] = m.background;
    cv["--color-on-background"] = m.onBackground;
    cv["--color-surface"] = m.surface;
    cv["--color-on-surface"] = m.onSurface;
    if (!("--color-error" in cv)) cv["--color-error"] = m.error;
    if (!("--color-on-error" in cv)) cv["--color-on-error"] = m.onError;
    const lines = [":root {"];
    for (const [k, v] of Object.entries(cv)) lines.push(`  ${k}: ${v};`);
    lines.push("}");
    return lines.join("\n");
  }

  function renderTheme(container, theme) {
    const m = theme.material;
    const fe = theme.frontend;
    const acc = theme.accessibility;
    const uiProf = fe && fe.contrastProfile ? `${fe.contrastProfile.ui} · text ≥ ${fe.contrastProfile.text}:1` : "";
    let html = `<p class="theme-mode-badge">Mode <strong>${theme.mode || "light"}</strong> · Tone <strong>${theme.tone || "clear"}</strong>${uiProf ? ` · ${uiProf}` : ""}</p>`;
    const rows = [
      ["Primary", m.primary, m.onPrimary, acc.primaryContrast],
      ["Secondary", m.secondary, m.onSecondary, acc.secondaryContrast],
      ["Tertiary", m.tertiary, m.onTertiary, acc.tertiaryContrast],
      ["Supplementary", m.supplementary, m.onSupplementary, acc.supplementaryContrast],
      ["Background", m.background, m.onBackground, acc.backgroundContrast],
      ["Surface", m.surface, m.onSurface, acc.surfaceContrast],
    ];
    html += '<div class="theme-grid">';
    for (const [label, bg, on, cr] of rows) {
      html += `<div class="token-row" style="background:${bg};color:${on}">
        <span class="tok-label">${label}</span><code>${bg}</code><span class="tok-on">on: ${on}</span>
        <span class="tok-cr">${cr.toFixed(2)}:1</span></div>`;
    }
    html += "</div>";
    html += '<div class="role-row">' + roleCard("Primary", m.primary, theme.usage.primary) + roleCard("Secondary", m.secondary, theme.usage.secondary) + roleCard("Tertiary", m.tertiary, theme.usage.tertiary) + roleCard("Supplementary", m.supplementary, theme.usage.supplementary) + "</div>";
    html += '<div class="variant-row"><span>Variants</span><code>primaryVariant: ' + m.primaryVariant + "</code><code>secondaryVariant: " + m.secondaryVariant + "</code></div>";
    if (fe && fe.semantic) {
      const s = fe.semantic;
      html += '<h3 class="token-section-title">Frontend tokens (sample)</h3><div class="semantic-grid">';
      const pairs = [
        ["background", s.background],
        ["surface", s.surface],
        ["textPrimary", s.textPrimary],
        ["textMuted", s.textMuted],
        ["link", s.link],
        ["buttonPrimaryBg", s.buttonPrimaryBg],
        ["tagBg", s.tagBg],
        ["borderSubtle", s.borderSubtle],
      ];
      for (const [lab, hx] of pairs) {
        const on = lab.startsWith("text") || lab === "link" ? s.background : s.textPrimary;
        html += `<div class="mini-swatch" style="background:${hx};color:${on}"><span>${lab}</span><code>${hx}</code></div>`;
      }
      html += "</div>";
    }
    html += '<ul class="why-list">';
    for (const w of theme.why) html += `<li>${w}</li>`;
    html += "</ul>";
    const poolSrc = theme.poolRowSources;
    const poolHint = poolSrc
      ? ` · color pool ${poolSrc.mindful} Mindful + ${poolSrc.pinterest} Pinterest palette rows`
      : "";
    html +=
      '<button type="button" class="copy-css" id="copy-theme-css">Copy full CSS variables</button> <span class="hint">' +
      theme.sourcePaletteCount +
      " palettes in theme pool · " +
      theme.candidateColorCount +
      " candidate swatches" +
      poolHint +
      "</span>";
    container.innerHTML = html;
    const css = buildThemeCssExport(theme);
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
        t.textContent = "Copied full token CSS";
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
    const toneEl = document.getElementById("theme-tone");
    const toneKeys =
      window.MoodWebsiteTheme && window.MoodWebsiteTheme.TONE_MODES ? Object.keys(window.MoodWebsiteTheme.TONE_MODES) : [];
    const mode = "light";
    const tone = toneEl && toneKeys.includes(toneEl.value) ? toneEl.value : "clear";
    errEl.hidden = true;
    statusEl.textContent = "Loading / scoring palettes…";
    try {
      const bundle = await ensurePalettes();
      if (gen !== buildGeneration) return;
      const list = bundle.list || [];
      const identityStr = moodScoreIdentity(target);
      const fp = dataFingerprint(list);

      const cachedTheme = loadThemeCache(identityStr, fp, mode, tone);
      if (cachedTheme && cachedTheme.theme) {
        if (gen !== buildGeneration) return;
        renderTheme(outEl, cachedTheme.theme);
        const th = cachedTheme.theme;
        const modeTone =
          th && th.mode && th.tone ? ` (${th.mode} · ${th.tone})` : ` (${mode} · ${tone})`;
        statusEl.textContent =
          cachedTheme.statusText ||
          `Theme ready for “${target.moodId}”${modeTone} (cached — same mood, extra words, library, mode, and tone).`;
        return;
      }

      const loadedScoreMap = loadScoreCache(identityStr, fp);
      const useScoreCache = loadedScoreMap && scoreMapCoversList(list, loadedScoreMap);
      const scorePersist = {};

      const rows = [];
      let maxScore = 0;
      let skippedIntra = 0;
      const nList = list.length;
      for (let i = 0; i < nList; i++) {
        const p = list[i];
        const hexes = (p.colors || []).map((c) => normalizeHex(c.hex)).filter(Boolean);
        if (hexes.length < 4) continue;
        const k = paletteStableKey(p);

        if (useScoreCache) {
          const ent = loadedScoreMap[k];
          if (ent === SCORE_CACHE_INTRA) {
            skippedIntra++;
            continue;
          }
          if (ent === SCORE_CACHE_BAD) continue;
          const s = Number(ent);
          if (Number.isNaN(s)) continue;
          maxScore = Math.max(maxScore, s);
          rows.push({ score: s, p, pal: p.__cachedPal });
          if (rows.length % SCORE_YIELD_INTERVAL === 0) {
            if (gen !== buildGeneration) return;
            statusEl.textContent = `Scoring… ${i + 1} / ${nList} (scores from cache)`;
            await new Promise((r) => setTimeout(r, 0));
          }
          continue;
        }

        let pal = p.__cachedPal;
        if (pal === undefined) {
          if (intraPaletteUnusableForWeb(hexes)) {
            p.__cachedPal = false;
            skippedIntra++;
            scorePersist[k] = SCORE_CACHE_INTRA;
            continue;
          }
          const analyzed = analyzePalette(hexes);
          if (!analyzed) {
            p.__cachedPal = false;
            scorePersist[k] = SCORE_CACHE_BAD;
            continue;
          }
          p.__cachedPal = analyzed;
          pal = analyzed;
        } else if (!pal) {
          scorePersist[k] = SCORE_CACHE_BAD;
          continue;
        }
        const summary = (p.paletteSummary || "").toLowerCase();
        const s = window.scoreMoodDirectional(pal, target.moodId, target.lemmas, summary);
        scorePersist[k] = s;
        maxScore = Math.max(maxScore, s);
        rows.push({ score: s, p, pal });
        if (rows.length % SCORE_YIELD_INTERVAL === 0) {
          if (gen !== buildGeneration) return;
          statusEl.textContent = `Scoring… ${i + 1} / ${nList}`;
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (!useScoreCache && Object.keys(scorePersist).length) {
        saveScoreCache(identityStr, fp, scorePersist);
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
        shown.sort((a, b) => {
          const ma = paletteSource(a.p) !== "pinterest";
          const mb = paletteSource(b.p) !== "pinterest";
          if (ma !== mb) return ma ? -1 : 1;
          return b.score - a.score;
        });
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
        minPaletteDistance: 0.073,
        poolPaletteLimit: 28,
        mode,
        tone,
      });
      if (gen !== buildGeneration) return;
      renderTheme(outEl, theme);
      const pr = theme.poolRowSources || { mindful: 0, pinterest: 0 };
      const statusText = `Theme ready for “${target.moodId}” (${mode} · ${tone}). ${shown.length} mood-filtered palettes → ${theme.sourcePaletteCount} after perceptual dedupe · color pool ${pr.mindful} Mindful + ${pr.pinterest} Pinterest palette rows${useScoreCache ? " · scores from session cache" : ""}.`;
      statusEl.textContent = statusText;
      saveThemeCache(identityStr, fp, theme, statusText, mode, tone);
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
    const toneEl = document.getElementById("theme-tone");
        if (toneEl) toneEl.addEventListener("change", debounce(() => selectedChipId && void runBuild(), 120));

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
