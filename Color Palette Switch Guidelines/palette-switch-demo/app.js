/**
 * Full-site palette demo: score Mindful (+ optional Pinterest) with mood-engine-v2,
 * then apply buildMoodWebsiteTheme from a user-chosen palette row.
 * Serve from "Designer's pandora box" — see README.md for URLs.
 */
(function () {
  "use strict";

  const DATA_BASE = "../../Mood to Color/demo/data/";
  const FONT_PAIRINGS_JSON_PATH = "./font-pairings.json";
  const FONT_PAIRINGS_MD_PATHS = [
    "../../Design Style Layout Markdown Library/Font pairings/font-pairing-library.md",
    "../../Design Style Layout Markdown Library/Font pairings/font-size-proportion-guideline.md",
  ];
  const MOTION_MAP_JSON_PATH = "../../Mood to Motion Map/mood-to-motion-map.json";
  const SCORE_YIELD_INTERVAL = 80;
  const MAX_LIST_PALETTES = 36;
  const MIN_SCORE_REL_TO_TOP = 0.65;
  const SCORE_CACHE_INTRA = "__intra__";
  const SCORE_CACHE_BAD = "__bad__";

  const ABS_MIN_BY_MOOD = {
    urgent: 0.58,
    calm: 0.56,
    lux: 0.55,
    festival: 0.56,
    pure: 0.58,
    clinical: 0.56,
    trust: 0.54,
    energy: 0.56,
    play: 0.52,
    earth: 0.52,
    melancholy: 0.52,
    joy: 0.56,
    romance: 0.52,
    tech: 0.56,
    cozy: 0.52,
    crisp: 0.55,
    noir: 0.54,
    nostalgia: 0.52,
    ocean: 0.52,
    forest: 0.52,
    midnight: 0.54,
    dawn: 0.56,
    wedding: 0.55,
    artisan: 0.52,
    default: 0.5,
  };

  const PALETTE_NEAR_DUPLICATE_SIMILARITY = 0.86;

  /** Assigned in bindPaletteApi() so a 404 on Mood scripts does not crash this file before main(). */
  let normalizeHex;
  let hexToRgb;
  let analyzePalette;
  let buildUnifiedPaletteList;
  let dedupeRowsByPaletteSimilarity;
  let intraPaletteUnusableForWeb;
  let paletteSource;

  function bindPaletteApi() {
    const api = window.MoodThemePalette;
    if (
      !api ||
      typeof api.normalizeHex !== "function" ||
      typeof api.hexToRgb !== "function" ||
      typeof window.scoreMoodDirectional !== "function" ||
      !Array.isArray(window.MOOD_CHIPS) ||
      !window.MoodWebsiteTheme ||
      typeof window.MoodWebsiteTheme.buildMoodWebsiteTheme !== "function"
    ) {
      return false;
    }
    normalizeHex = api.normalizeHex;
    hexToRgb = api.hexToRgb;
    analyzePalette = api.analyzePalette;
    buildUnifiedPaletteList = api.buildUnifiedPaletteList;
    dedupeRowsByPaletteSimilarity = api.dedupeRowsByPaletteSimilarity;
    intraPaletteUnusableForWeb = api.intraPaletteUnusableForWeb;
    paletteSource = api.paletteSource;
    return true;
  }

  let paletteBundle = null;
  let selectedChipId = "tech";
  let lastTheme = null;
  let lastShownRows = [];
  /** Row last applied or auto-applied; mode/tone changes rebuild from this pool. */
  let lastAppliedRow = null;
  let lastAppliedPaletteKey = null;
  let lastAppliedCoreSelection = null;
  let lastAppliedShuffleStep = 0;
  let lastAppliedTone = "clear";
  /** User-selected view mode from floating switch; if set, overrides shuffle mode flips. */
  let preferredMode = "light";
  /** Track how many shuffle variations user requested per palette row. */
  const shuffleStepsByPalette = new Map();
  /** Track inline CSS vars set by theme apply so Cancel can fully restore baseline. */
  const appliedCssVarKeys = new Set();
  /** Per-palette editable swatch lists, used by apply/shuffle. */
  const customColorsByPalette = new Map();
  let typographyPairs = [];
  let currentTypographyKey = "";
  const loadedFontFamilies = new Set();
  let motionProfiles = [];
  let motionPresetById = {};
  let currentMotionId = "";
  let motionInteractionsBound = false;
  const motionRevealSelector =
    ".hero__inner > *, .features > *, .kpi-grid > *, .workspace-grid > *, .pricing > *, .faq-list > *, .comparison-table tbody tr, .stats > *";
  const motionInteractiveSelector =
    ".btn, .btn-hero-primary, .btn-hero-secondary, .card, .kpi-card, .panel, .price-card, .faq-item, .pipeline-item, .tag";

  function paletteStableKey(p) {
    return `${paletteSource(p)}:${p.paletteNumber}`;
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

  function parseFontPairings(markdown) {
    const rows = [];
    const seen = new Set();
    const pairRegex = /\[([^\]]+?)\]\([^)]+\)/gm;
    let match;
    while ((match = pairRegex.exec(markdown))) {
      const title = String(match[1] || "").trim();
      if (!title.includes("+")) continue;
      const parts = title.split("+").map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const heading = parts[0];
      const body = parts[1];
      const key = `${heading}__${body}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ heading, body, key });
    }

    // Secondary pass for plain "A + B" occurrences in tables/text.
    const plainPairRegex = /([A-Za-z0-9'&.\- ]{2,})\s\+\s([A-Za-z0-9'&.\- ]{2,})/gm;
    let m2;
    while ((m2 = plainPairRegex.exec(markdown))) {
      const heading = String(m2[1] || "").trim();
      const body = String(m2[2] || "").trim();
      if (!heading || !body) continue;
      const key = `${heading}__${body}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ heading, body, key });
    }
    return rows;
  }

  function ensureTypographyLink(pair) {
    const doc = document;
    const id = "dynamic-font-pair-link";
    let link = doc.getElementById(id);
    if (!link) {
      link = doc.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      doc.head.appendChild(link);
    }
    const family = (name) => encodeURIComponent(name.trim()).replace(/%20/g, "+");
    link.href = `https://fonts.googleapis.com/css2?family=${family(pair.heading)}:wght@400;500;600;700&family=${family(pair.body)}:wght@400;500;600;700&display=swap`;
  }

  function ensureFontFamilyLoaded(name) {
    const font = String(name || "").trim();
    if (!font) return;
    const key = font.toLowerCase();
    if (loadedFontFamilies.has(key)) return;
    loadedFontFamilies.add(key);
    const id = `font-family-${key.replace(/[^a-z0-9]+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    const family = encodeURIComponent(font).replace(/%20/g, "+");
    link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  function applyTypographyPair(pair) {
    if (!pair) return;
    ensureTypographyLink(pair);
    const root = document.documentElement;
    root.style.setProperty("--font-heading", `"${pair.heading}", "${pair.body}", sans-serif`);
    root.style.setProperty("--font-body", `"${pair.body}", "${pair.heading}", sans-serif`);
    currentTypographyKey = pair.key;
  }

  function renderTypographyList(container, pairs) {
    if (!container) return;
    container.innerHTML = "";
    if (!pairs.length) {
      container.innerHTML = '<p class="hint">No font pairings found.</p>';
      return;
    }
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const el = entry.target;
                const h = el.getAttribute("data-heading-font") || "";
                const b = el.getAttribute("data-body-font") || "";
                ensureFontFamilyLoaded(h);
                ensureFontFamilyLoaded(b);
                observer.unobserve(el);
              }
            },
            { root: container, threshold: 0.1 },
          )
        : null;
    for (const pair of pairs) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "typography-card";
      card.setAttribute("data-font-key", pair.key);
      card.setAttribute("data-heading-font", pair.heading);
      card.setAttribute("data-body-font", pair.body);
      card.innerHTML = `
        <div class="typography-card__label">${pair.heading} + ${pair.body}</div>
        <div class="typography-card__title" style="font-family: '${pair.heading}', '${pair.body}', sans-serif;">
          Heading Preview Aa
        </div>
        <div class="typography-card__body" style="font-family: '${pair.body}', '${pair.heading}', sans-serif;">
          Paragraph preview: agile teams ship better products when typography hierarchy stays clear and readable.
        </div>
      `;
      card.addEventListener("mouseenter", () => {
        ensureFontFamilyLoaded(pair.heading);
        ensureFontFamilyLoaded(pair.body);
      });
      card.addEventListener("click", () => {
        applyTypographyPair(pair);
        for (const el of container.querySelectorAll(".typography-card")) {
          el.classList.toggle("typography-card--selected", el.getAttribute("data-font-key") === pair.key);
        }
      });
      if (pair.key === currentTypographyKey) {
        card.classList.add("typography-card--selected");
      }
      container.appendChild(card);
      if (observer) observer.observe(card);
    }
    // Prime first visible set for immediate accurate previews.
    for (const pair of pairs.slice(0, 14)) {
      ensureFontFamilyLoaded(pair.heading);
      ensureFontFamilyLoaded(pair.body);
    }
  }

  async function ensureTypographyPairs() {
    if (typographyPairs.length) return typographyPairs;
    try {
      const local = await fetch(FONT_PAIRINGS_JSON_PATH);
      if (local.ok) {
        const payload = await local.json();
        if (payload && Array.isArray(payload.pairs) && payload.pairs.length) {
          typographyPairs = payload.pairs
            .map((p) => ({
              heading: String(p.heading || "").trim(),
              body: String(p.body || "").trim(),
              key: String(p.key || `${p.heading || ""}__${p.body || ""}`).toLowerCase(),
            }))
            .filter((p) => p.heading && p.body);
        }
      }
      if (typographyPairs.length) {
        // loaded from local generated data
      } else {
      const texts = [];
      for (const path of FONT_PAIRINGS_MD_PATHS) {
        const res = await fetch(path);
        if (!res.ok) continue;
        texts.push(await res.text());
      }
      if (!texts.length) throw new Error("Could not load font pairing markdown files.");
      const merged = texts.join("\n\n");
      typographyPairs = parseFontPairings(merged);
      if (!typographyPairs.length) throw new Error("No pairings parsed from markdown.");
      }
    } catch {
      typographyPairs = [
        { heading: "DM Sans", body: "Inter", key: "dm sans__inter" },
        { heading: "Playfair Display", body: "Source Sans 3", key: "playfair display__source sans 3" },
        { heading: "Space Grotesk", body: "Work Sans", key: "space grotesk__work sans" },
        { heading: "Merriweather", body: "Lato", key: "merriweather__lato" },
        { heading: "Lora", body: "Montserrat", key: "lora__montserrat" },
        { heading: "Poppins", body: "Roboto", key: "poppins__roboto" },
        { heading: "Libre Baskerville", body: "Open Sans", key: "libre baskerville__open sans" },
        { heading: "Oswald", body: "Nunito Sans", key: "oswald__nunito sans" },
      ];
    }
    if (!currentTypographyKey && typographyPairs[0]) {
      currentTypographyKey = typographyPairs[0].key;
      applyTypographyPair(typographyPairs[0]);
    }
    return typographyPairs;
  }

  function humanizeMotionId(id) {
    return String(id || "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase())
      .trim();
  }

  function paceToMs(paceWord, fallback) {
    const v = String(paceWord || "").toLowerCase();
    if (v.includes("very fast")) return 140;
    if (v.includes("fast")) return 180;
    if (v.includes("tight")) return 200;
    if (v.includes("medium")) return 280;
    if (v.includes("slow")) return 520;
    if (v.includes("gentle")) return 620;
    return fallback;
  }

  function getMotionTiming(profile) {
    const timing = profile?.timing || {};
    const pace = timing.paceInWords || {};
    const legacy = timing.legacyMsReference || {};
    const duration =
      (Array.isArray(legacy.durationMs) && legacy.durationMs[0]) ||
      paceToMs(pace.entrance, 280);
    const stagger =
      (Array.isArray(legacy.staggerMs) && legacy.staggerMs[0]) ||
      paceToMs(pace.betweenItems, 40);
    return { duration: Math.max(120, duration), stagger: Math.max(12, stagger) };
  }

  function replayMotionAnimations(profile) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const { duration, stagger } = getMotionTiming(profile);
    const isPlayful = /playful|bouncy|festival/i.test(profile?.id || "");
    const distance = isPlayful ? 16 : 10;
    const easing = isPlayful ? "cubic-bezier(0.34,1.56,0.64,1)" : "cubic-bezier(0.22,1,0.36,1)";
    const nodes = Array.from(document.querySelectorAll(motionRevealSelector));
    nodes.forEach((el, idx) => {
      if (typeof el.animate !== "function") return;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [
          { opacity: 0, transform: `translateY(${distance}px) scale(${isPlayful ? 0.985 : 0.995})` },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        {
          duration: Math.round(duration * 1.05),
          delay: Math.min(900, idx * Math.min(65, stagger)),
          easing,
          fill: "both",
        }
      );
    });
  }

  function bindMotionInteractions() {
    if (motionInteractionsBound) return;
    motionInteractionsBound = true;
    document.addEventListener(
      "pointerenter",
      (event) => {
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const target = event.target.closest(motionInteractiveSelector);
        if (!target || typeof target.animate !== "function") return;
        target.animate(
          [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-2px) scale(1.015)" }],
          { duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "forwards" }
        );
      },
      true
    );
    document.addEventListener(
      "pointerleave",
      (event) => {
        const target = event.target.closest(motionInteractiveSelector);
        if (!target || typeof target.animate !== "function") return;
        target.animate([{ transform: "translateY(-2px) scale(1.015)" }, { transform: "translateY(0) scale(1)" }], {
          duration: 140,
          easing: "ease-out",
          fill: "forwards",
        });
      },
      true
    );
    document.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target.closest(motionInteractiveSelector);
        if (!target || typeof target.animate !== "function") return;
        target.animate([{ transform: "scale(1)" }, { transform: "scale(0.98)" }], {
          duration: 90,
          easing: "ease-out",
          fill: "forwards",
        });
      },
      true
    );
    document.addEventListener(
      "pointerup",
      (event) => {
        const target = event.target.closest(motionInteractiveSelector);
        if (!target || typeof target.animate !== "function") return;
        target.animate([{ transform: "scale(0.98)" }, { transform: "scale(1)" }], {
          duration: 120,
          easing: "ease-out",
          fill: "forwards",
        });
      },
      true
    );
  }

  function applyMotionProfile(profile) {
    if (!profile) return;
    const root = document.documentElement;
    const { duration, stagger } = getMotionTiming(profile);
    const isPlayful = /playful|bouncy|festival/i.test(profile.id || "");
    const isPrecise = /precise|technical|clinical/i.test(profile.id || "");
    const isCinematic = /cinematic|story|ambient/i.test(profile.id || "");

    root.style.setProperty("--motion-duration-base", `${Math.max(120, duration)}ms`);
    root.style.setProperty("--motion-duration-fast", `${Math.max(90, Math.round(duration * 0.6))}ms`);
    root.style.setProperty("--motion-stagger", `${Math.max(12, stagger)}ms`);
    root.style.setProperty("--motion-reveal-distance", isPlayful ? "12px" : isPrecise ? "6px" : "10px");
    root.style.setProperty("--motion-hover-scale", isPlayful ? "1.03" : isPrecise ? "1.01" : "1.02");
    root.style.setProperty("--motion-click-scale", isPlayful ? "0.97" : "0.985");
    root.style.setProperty("--motion-bg-drift", isCinematic ? "26s" : isPrecise ? "0s" : "18s");
    root.style.setProperty("--motion-glow-opacity", isCinematic ? "0.22" : isPrecise ? "0.08" : "0.14");
    root.style.setProperty("--motion-ease", isPlayful ? "cubic-bezier(0.34,1.56,0.64,1)" : "cubic-bezier(0.22,1,0.36,1)");
    root.setAttribute("data-motion-profile", profile.id || "");
    currentMotionId = profile.id || "";

    // Replay entry motion when user changes profile.
    document.body.classList.remove("motion-animate");
    // eslint-disable-next-line no-unused-expressions
    document.body.offsetHeight;
    document.body.classList.add("motion-animate");
    replayMotionAnimations(profile);
    bindMotionInteractions();
  }

  function renderMotionList(container, profiles) {
    if (!container) return;
    container.innerHTML = "";
    if (!profiles.length) {
      container.innerHTML = '<p class="hint">No motion profiles found.</p>';
      return;
    }
    for (const profile of profiles) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "motion-card";
      card.setAttribute("data-motion-id", profile.id || "");
      const pace = profile.timing?.paceInWords || {};
      const paceText = [pace.entrance, pace.betweenItems].filter(Boolean).join(" / ");
      card.innerHTML = `
        <div class="motion-card__title">${profile.label || humanizeMotionId(profile.id)}</div>
        <div class="motion-card__meta">${paceText || profile.timing?.pickerLabel || "balanced motion"}</div>
        <div class="motion-card__body">${profile.timing?.whatItFeelsLike || profile.guidanceHuman || ""}</div>
      `;
      card.addEventListener("click", () => {
        applyMotionProfile(profile);
        for (const el of container.querySelectorAll(".motion-card")) {
          el.classList.toggle("motion-card--selected", el.getAttribute("data-motion-id") === profile.id);
        }
        const selectEl = document.getElementById("motion-mood-select");
        const detailEl = document.getElementById("motion-detail");
        if (selectEl) selectEl.value = profile.id || "";
        if (detailEl) detailEl.textContent = profile.timing?.whatItFeelsLike || profile.guidanceHuman || "";
      });
      if ((profile.id || "") === currentMotionId) {
        card.classList.add("motion-card--selected");
      }
      container.appendChild(card);
    }
  }

  function renderMotionSelect(selectEl, detailEl, profiles) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    for (const profile of profiles) {
      const opt = document.createElement("option");
      opt.value = profile.id || "";
      opt.textContent = profile.label || humanizeMotionId(profile.id);
      selectEl.appendChild(opt);
    }
    const active = profiles.find((p) => p.id === currentMotionId) || profiles[0] || null;
    if (active) {
      selectEl.value = active.id;
      if (detailEl) {
        detailEl.textContent = active.timing?.whatItFeelsLike || active.guidanceHuman || "";
      }
    }
    selectEl.onchange = () => {
      const next = profiles.find((p) => p.id === selectEl.value);
      if (!next) return;
      applyMotionProfile(next);
      if (detailEl) {
        detailEl.textContent = next.timing?.whatItFeelsLike || next.guidanceHuman || "";
      }
      const list = document.getElementById("motion-list");
      if (list) {
        for (const el of list.querySelectorAll(".motion-card")) {
          el.classList.toggle("motion-card--selected", el.getAttribute("data-motion-id") === next.id);
        }
      }
    };
  }

  async function ensureMotionProfiles() {
    if (motionProfiles.length) return motionProfiles;
    try {
      const res = await fetch(MOTION_MAP_JSON_PATH);
      if (!res.ok) throw new Error(`Could not load motion map (${res.status})`);
      const map = await res.json();
      motionPresetById = map.timingPresets || {};
      const clusters = Array.isArray(map.moodClusters) ? map.moodClusters : [];
      motionProfiles = clusters.map((c) => {
        const presetId = c?.timing?.presetId || "";
        const preset = motionPresetById[presetId] || {};
        return {
          id: c.id || presetId || `motion-${Math.random()}`,
          label: c.id ? humanizeMotionId(c.id) : preset?.label || "Motion",
          guidanceHuman: c.guidanceHuman || "",
          timing: {
            ...preset,
            ...(c.timing || {}),
          },
        };
      });
      if (!motionProfiles.length) throw new Error("No motion profiles parsed.");
    } catch {
      motionProfiles = [
        { id: "gentle", label: "Gentle", timing: { paceInWords: { entrance: "slow", betweenItems: "relaxed" }, whatItFeelsLike: "Soft and calm motion." } },
        { id: "snappy", label: "Snappy", timing: { paceInWords: { entrance: "fast", betweenItems: "tight" }, whatItFeelsLike: "Fast and confident motion." } },
        { id: "playful", label: "Playful", timing: { paceInWords: { entrance: "medium", betweenItems: "medium" }, whatItFeelsLike: "Friendly bouncy interactions." } },
      ];
    }
    if (!currentMotionId && motionProfiles[0]) {
      applyMotionProfile(motionProfiles[0]);
    }
    return motionProfiles;
  }

  function renderMoodSelect(selectEl, detailEl, moodId, onPick) {
    if (!selectEl || !Array.isArray(window.MOOD_CHIPS)) return;
    selectEl.innerHTML = "";
    for (const c of window.MOOD_CHIPS) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      selectEl.appendChild(opt);
    }

    const active = window.MOOD_CHIPS.find((c) => c.id === moodId) || window.MOOD_CHIPS[0] || null;
    if (active) {
      selectEl.value = active.id;
      if (detailEl) detailEl.textContent = active.detail || "";
      if (active.id !== moodId) onPick(active.id);
    } else if (detailEl) {
      detailEl.textContent = "";
    }

    selectEl.addEventListener("change", () => {
      const next = selectEl.value;
      const chip = window.MOOD_CHIPS.find((c) => c.id === next);
      if (detailEl) detailEl.textContent = chip?.detail || "";
      onPick(next);
    });
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
    if (fe && fe.components && fe.components.footer) {
      const f = fe.components.footer;
      cv["--color-footer-bg"] = f.bg;
      cv["--color-footer-text"] = f.text;
      cv["--color-footer-link"] = f.link;
    }
    const lines = [":root {"];
    for (const [k, v] of Object.entries(cv)) lines.push(`  ${k}: ${v};`);
    lines.push("}");
    return lines.join("\n");
  }

  function applyThemeToDocument(theme) {
    const m = theme.material;
    const fe = theme.frontend;
    const root = document.documentElement;
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
    if (fe && fe.components && fe.components.footer) {
      const f = fe.components.footer;
      cv["--color-footer-bg"] = f.bg;
      cv["--color-footer-text"] = f.text;
      cv["--color-footer-link"] = f.link;
    }
    for (const [k, v] of Object.entries(cv)) {
      root.style.setProperty(k, String(v));
      appliedCssVarKeys.add(k);
    }
    root.setAttribute("data-theme-mode", theme.mode || "light");
    root.setAttribute("data-theme-tone", theme.tone || "clear");
    root.setAttribute("data-theme-mood", theme.mood || "");
    lastTheme = theme;
  }

  function restoreOriginalTheme(statusEl) {
    const root = document.documentElement;
    for (const key of appliedCssVarKeys) {
      root.style.removeProperty(key);
    }
    appliedCssVarKeys.clear();
    root.removeAttribute("data-theme-mode");
    root.removeAttribute("data-theme-tone");
    root.removeAttribute("data-theme-mood");
    lastTheme = null;
    lastAppliedRow = null;
    highlightSelectedPalette();
    if (statusEl) {
      statusEl.textContent = "Restored original color system.";
    }
  }

  async function ensurePalettes() {
    if (paletteBundle) return paletteBundle;
    const [mRes, pRes] = await Promise.all([
      fetch(`${DATA_BASE}mindful-palettes.json`),
      fetch(`${DATA_BASE}pinterest-colors.json`),
    ]);
    if (!mRes.ok) throw new Error(`Could not load mindful-palettes.json (${mRes.status})`);
    const mindful = await mRes.json();
    let pinterest = { palettes_by_image: [] };
    if (pRes.ok) {
      try {
        pinterest = await pRes.json();
      } catch {
        pinterest = { palettes_by_image: [] };
      }
    }
    const list = buildUnifiedPaletteList(mindful, pinterest);
    paletteBundle = { mindful, pinterest, list };
    return paletteBundle;
  }

  function highlightSelectedPalette() {
    const grid = document.getElementById("palette-grid");
    if (!grid) return;
    const key = lastAppliedRow ? paletteStableKey(lastAppliedRow.p) : null;
    for (const el of grid.querySelectorAll(".palette-card")) {
      el.classList.toggle("palette-card--selected", Boolean(key && el.dataset.paletteKey === key));
    }
  }

  function syncCardModeButtons(activeMode) {
    const mode = activeMode === "dark" ? "dark" : "light";
    const buttons = document.querySelectorAll(".palette-mode-btn");
    for (const btn of buttons) {
      const isMatch = btn.getAttribute("data-mode") === mode;
      btn.setAttribute("aria-pressed", isMatch ? "true" : "false");
    }
  }

  function hueDistanceDeg(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  }

  function buildColorSignature(hex, originalIndex) {
    const [r, g, b] = hexToRgb(normalizeHex(hex));
    const [h, s, l] = rgbToHsl(r, g, b);
    const temp = Math.cos((h * Math.PI) / 180) * (s + 0.05);
    return { hex, h, s, l, temp, i: originalIndex };
  }

  function colorSimilarity(a, b) {
    const hueDist = hueDistanceDeg(a.h, b.h) / 180;
    const satDist = Math.abs(a.s - b.s);
    const lightDist = Math.abs(a.l - b.l);
    const tempDist = Math.abs(a.temp - b.temp) / 2;
    const chromatic = a.s > 0.12 && b.s > 0.12 ? 1 : 0.35;
    return hueDist * 0.46 * chromatic + satDist * 0.28 + lightDist * 0.2 + tempDist * 0.06;
  }

  function colorDiversityScore(c) {
    const chromaScore = c.s * 0.52;
    const lightExtremes = Math.abs(c.l - 0.5) * 0.32;
    const vividBonus = c.s > 0.5 ? 0.08 : 0;
    const neutralAnchorBonus = c.s < 0.12 ? 0.05 : 0;
    return chromaScore + lightExtremes + vividBonus + neutralAnchorBonus;
  }

  function compactDistinctPalette(hexes, targetCount = 4) {
    const deduped = [...new Set((hexes || []).map((h) => normalizeHex(h)).filter(Boolean))];
    if (deduped.length <= targetCount) return deduped;

    const picked = deduped.map((hex, idx) => buildColorSignature(hex, idx));
    while (picked.length > targetCount) {
      let aIdx = 0;
      let bIdx = 1;
      let minDist = Infinity;
      for (let i = 0; i < picked.length; i++) {
        for (let j = i + 1; j < picked.length; j++) {
          const dist = colorSimilarity(picked[i], picked[j]);
          if (dist < minDist) {
            minDist = dist;
            aIdx = i;
            bIdx = j;
          }
        }
      }
      const a = picked[aIdx];
      const b = picked[bIdx];
      const removeIdx = colorDiversityScore(a) <= colorDiversityScore(b) ? aIdx : bIdx;
      picked.splice(removeIdx, 1);
    }

    picked.sort((x, y) => x.i - y.i);
    return picked.map((c) => c.hex);
  }

  function normalizeBackgroundFromSource(sourceHex, mode) {
    const src = normalizeHex(sourceHex);
    if (!src) return mode === "dark" ? "#0a0d12" : "#f8fafc";
    if (mode === "dark") {
      return mixHex(src, "#05070b", 0.82);
    }
    const [r, g, b] = hexToRgb(src);
    const [, s, l] = rgbToHsl(r, g, b);
    // Mild guard for muddy light-mode backgrounds from saturated swatches.
    if (s > 0.16 || (s > 0.1 && l < 0.55)) {
      return "#f8fafc";
    }
    const whiteMix = s > 0.1 ? 0.95 : 0.9;
    return mixHex(src, "#ffffff", whiteMix);
  }

  function getEffectiveColorsForRow(row) {
    const key = paletteStableKey(row.p);
    const custom = customColorsByPalette.get(key);
    if (Array.isArray(custom) && custom.length) {
      return compactDistinctPalette(custom, 4);
    }
    const original = (row.p.colors || []).map((c) => normalizeHex(c.hex)).filter(Boolean);
    return compactDistinctPalette(original, 4);
  }

  function getEffectiveRowForApply(row) {
    const colors = getEffectiveColorsForRow(row).map((hex) => ({ hex }));
    return {
      ...row,
      p: {
        ...row.p,
        colors: colors.length ? colors : row.p.colors || [],
      },
    };
  }

  function renderPaletteGrid(container, rows, onApply, onShuffle, onCancel, onSetMode) {
    container.innerHTML = "";
    if (!rows.length) {
      container.innerHTML = '<p class="hint">No palettes matched. Try another mood or words.</p>';
      return;
    }
    for (const r of rows) {
      const card = document.createElement("div");
      card.className = "palette-card";
      card.dataset.paletteKey = paletteStableKey(r.p);
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Apply ${r.p.displayTitle || r.p.paletteNumber} palette to website`);

      const sw = document.createElement("div");
      sw.className = "palette-card__swatches";
      sw.setAttribute("aria-hidden", "true");
      const picker = document.createElement("input");
      picker.type = "color";
      picker.className = "palette-swatch-picker";
      picker.tabIndex = -1;

      const renderSwatches = () => {
        sw.innerHTML = "";
        const colors = getEffectiveColorsForRow(r);
        const key = paletteStableKey(r.p);
        if (!customColorsByPalette.has(key)) {
          customColorsByPalette.set(key, [...colors]);
        }

        colors.forEach((hex, idx) => {
          const item = document.createElement("div");
          item.className = "palette-swatch-item";

          const color = document.createElement("span");
          color.className = "palette-swatch-color";
          color.style.background = hex || "#ccc";

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "palette-swatch-remove";
          removeBtn.textContent = "-";
          removeBtn.title = "Remove color";
          removeBtn.disabled = colors.length <= 2;
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const next = colors.filter((_, i) => i !== idx);
            customColorsByPalette.set(key, next);
            renderSwatches();
          });

          item.appendChild(color);
          item.appendChild(removeBtn);
          sw.appendChild(item);
        });

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "palette-swatch-add";
        addBtn.textContent = "+";
        addBtn.title = "Add color";
        addBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          // Prefer native wheel/popover picker where supported.
          if (typeof picker.showPicker === "function") {
            picker.showPicker();
            return;
          }
          picker.click();
        });
        sw.appendChild(addBtn);
      };

      picker.addEventListener("input", () => {
        const key = paletteStableKey(r.p);
        const nextHex = normalizeHex(picker.value);
        if (!nextHex) return;
        const colors = getEffectiveColorsForRow(r);
        colors.push(nextHex);
        customColorsByPalette.set(key, colors);
        renderSwatches();
      });
      renderSwatches();

      const foot = document.createElement("div");
      foot.className = "palette-card__foot";
      const actions = document.createElement("div");
      actions.className = "palette-card__actions";
      const lightBtn = document.createElement("button");
      lightBtn.type = "button";
      lightBtn.className = "palette-mini-btn palette-mode-btn";
      lightBtn.setAttribute("data-mode", "light");
      lightBtn.textContent = "Light";
      const darkBtn = document.createElement("button");
      darkBtn.type = "button";
      darkBtn.className = "palette-mini-btn palette-mode-btn";
      darkBtn.setAttribute("data-mode", "dark");
      darkBtn.textContent = "Dark";
      const shuffleBtn = document.createElement("button");
      shuffleBtn.type = "button";
      shuffleBtn.className = "palette-mini-btn palette-mini-btn--shuffle";
      shuffleBtn.textContent = "Shuffle";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "palette-mini-btn palette-mini-btn--cancel";
      cancelBtn.textContent = "Cancel";
      lightBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onSetMode(r, "light");
      });
      darkBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onSetMode(r, "dark");
      });
      shuffleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onShuffle(r);
        highlightSelectedPalette();
      });
      cancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onCancel();
      });
      actions.appendChild(lightBtn);
      actions.appendChild(darkBtn);
      actions.appendChild(shuffleBtn);
      actions.appendChild(cancelBtn);
      foot.appendChild(actions);

      card.addEventListener("click", () => {
        onApply(getEffectiveRowForApply(r));
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onApply(getEffectiveRowForApply(r));
        }
      });

      card.appendChild(sw);
      card.appendChild(picker);
      card.appendChild(foot);
      container.appendChild(card);
    }
    syncCardModeButtons(preferredMode);
    highlightSelectedPalette();
  }

  function runApplySingleRow(row, target, mode, tone, statusEl, opts = {}) {
    const shuffleStep = opts.shuffleStep || 0;
    const actionLabel = opts.actionLabel || "Applied";
    const forceMode = opts.forceMode || null;
    lastAppliedRow = row;
    lastAppliedPaletteKey = paletteStableKey(row.p);
    lastAppliedShuffleStep = shuffleStep;
    lastAppliedTone = tone || "clear";
    const theme = buildRuleDrivenTheme(row, target.moodId, mode, tone, {
      shuffleStep,
      allowModeShuffle: Boolean(opts.allowModeShuffle),
      forceMode,
      lockedCoreSelection: opts.lockedCoreSelection || null,
    });
    lastAppliedCoreSelection = theme.coreSelection || null;
    applyThemeToDocument(theme);
    preferredMode = (theme.mode || mode) === "dark" ? "dark" : "light";
    syncCardModeButtons(preferredMode);
    const src = paletteSource(row.p);
    const label = row.p.displayTitle || `#${row.p.paletteNumber}`;
    const appliedMode = theme.mode || mode;
    if (statusEl) {
      statusEl.textContent = `${actionLabel} ${label} (${src}) · ${appliedMode} · ${tone}. Rule mapping: bg ${theme.material.background}, block ${theme.material.primary}, tag ${theme.frontend.cssVariables["--color-tag-bg"]}.`;
    }
    highlightSelectedPalette();
  }

  async function runFindPalettes() {
    const statusEl = document.getElementById("status");
    const errEl = document.getElementById("err");
    const gridEl = document.getElementById("palette-grid");
    const extraEl = document.getElementById("extra");
    const toneEl = document.getElementById("theme-tone");

    if (!normalizeHex || !analyzePalette) {
      if (statusEl) {
        statusEl.textContent =
          "Palette engine not loaded. Serve this page via HTTP from the folder that contains both “Mood to Color” and “Color Palette Switch Guidelines” (see palette-switch-demo/README.md).";
      }
      return;
    }

    const target = aggregateTarget(selectedChipId, extraEl ? extraEl.value || "" : "");
    if (errEl) errEl.hidden = true;
    if (!target) {
      if (statusEl) statusEl.textContent = "Select a mood chip first.";
      if (gridEl) gridEl.innerHTML = "";
      return;
    }

    const toneKeys =
      window.MoodWebsiteTheme && window.MoodWebsiteTheme.TONE_MODES
        ? Object.keys(window.MoodWebsiteTheme.TONE_MODES)
        : [];
    const mode = preferredMode || "light";
    const tone = toneEl && toneKeys.includes(toneEl.value) ? toneEl.value : "clear";

    if (statusEl) statusEl.textContent = "Loading library…";
    try {
      const bundle = await ensurePalettes();
      const list = bundle.list || [];
      if (statusEl) statusEl.textContent = "Scoring palettes…";

      const rows = [];
      let maxScore = 0;
      const nList = list.length;

      for (let i = 0; i < nList; i++) {
        const p = list[i];
        const hexes = (p.colors || []).map((c) => normalizeHex(c.hex)).filter(Boolean);
        if (hexes.length < 4) continue;

        let pal = p.__cachedPal;
        if (pal === undefined) {
          if (intraPaletteUnusableForWeb(hexes)) {
            p.__cachedPal = false;
            continue;
          }
          const analyzed = analyzePalette(hexes);
          if (!analyzed) {
            p.__cachedPal = false;
            continue;
          }
          p.__cachedPal = analyzed;
          pal = analyzed;
        } else if (!pal) {
          continue;
        }

        const summary = (p.paletteSummary || "").toLowerCase();
        const s = window.scoreMoodDirectional(pal, target.moodId, target.lemmas, summary);
        maxScore = Math.max(maxScore, s);
        rows.push({ score: s, p, pal });

        if (rows.length % SCORE_YIELD_INTERVAL === 0) {
          if (statusEl) statusEl.textContent = `Scoring… ${i + 1} / ${nList}`;
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
        shown.sort((a, b) => {
          const ma = paletteSource(a.p) !== "pinterest";
          const mb = paletteSource(b.p) !== "pinterest";
          if (ma !== mb) return ma ? -1 : 1;
          return b.score - a.score;
        });
        shown = shown.slice(0, MAX_LIST_PALETTES);
      }

      lastShownRows = shown;
      if (!shown.length) {
        if (statusEl) statusEl.textContent = "No palettes passed the mood filter.";
        if (gridEl) gridEl.innerHTML = "";
        return;
      }

      if (statusEl) statusEl.textContent = `${shown.length} themes · use Apply or Shuffle to update the site (${mode} · ${tone}).`;
      if (gridEl) {
        renderPaletteGrid(
          gridEl,
          shown,
          (row) => {
            runApplySingleRow(row, target, mode, tone, statusEl, {
              shuffleStep: 0,
              actionLabel: "Applied",
              forceMode: preferredMode,
            });
          },
          (row) => {
            const effective = getEffectiveRowForApply(row);
            const key = paletteStableKey(row.p);
            const nextStep = (shuffleStepsByPalette.get(key) || 0) + 1;
            shuffleStepsByPalette.set(key, nextStep);
            runApplySingleRow(effective, target, mode, tone, statusEl, {
              shuffleStep: nextStep,
              actionLabel: "Shuffled",
              allowModeShuffle: true,
              forceMode: preferredMode,
            });
          },
          () => {
            restoreOriginalTheme(statusEl);
          },
          (row, nextMode) => {
            preferredMode = nextMode === "dark" ? "dark" : "light";
            const rowKey = paletteStableKey(row.p);
            const shouldLockCurrent = rowKey === lastAppliedPaletteKey && Boolean(lastAppliedCoreSelection);
            runApplySingleRow(getEffectiveRowForApply(row), target, preferredMode, tone, statusEl, {
              shuffleStep: lastAppliedRow && paletteStableKey(lastAppliedRow.p) === paletteStableKey(row.p) ? lastAppliedShuffleStep : 0,
              actionLabel: "Mode switched",
              forceMode: preferredMode,
              lockedCoreSelection: shouldLockCurrent ? lastAppliedCoreSelection : null,
            });
          },
        );
      }
    } catch (e) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = String(e.message || e);
      }
      if (statusEl) statusEl.textContent = "";
      if (gridEl) gridEl.innerHTML = "";
    }
  }

  function debounce(fn, ms) {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function showToast(msg) {
    const t = document.getElementById("copy-toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("copy-toast--visible");
    setTimeout(() => t.classList.remove("copy-toast--visible"), 1800);
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function rgb01ToHex(r, g, b) {
    const R = Math.round(clamp01(r) * 255);
    const G = Math.round(clamp01(g) * 255);
    const B = Math.round(clamp01(b) * 255);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

  function hslToRgb(h, s, l) {
    const sat = clamp01(s);
    const lig = clamp01(l);
    const a = sat * Math.min(lig, 1 - lig);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return lig - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return [f(0), f(8), f(4)];
  }

  function rgbToHsl(r, g, b) {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const d = mx - mn;
    if (d < 1e-9) return [0, 0, l];
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h0 = 0;
    if (mx === r) h0 = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h0 = (b - r) / d + 2;
    else h0 = (r - g) / d + 4;
    return [h0 * 60, s, l];
  }

  function mixHex(a, b, t) {
    const [ra, ga, ba] = hexToRgb(normalizeHex(a));
    const [rb, gb, bb] = hexToRgb(normalizeHex(b));
    const k = clamp01(t);
    return rgb01ToHex(ra * (1 - k) + rb * k, ga * (1 - k) + gb * k, ba * (1 - k) + bb * k);
  }

  function luminance(hex) {
    const [r, g, b] = hexToRgb(normalizeHex(hex));
    const linear = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
    const R = linear(r);
    const G = linear(g);
    const B = linear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  function contrastRatio(a, b) {
    const l1 = luminance(a);
    const l2 = luminance(b);
    const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  }

  function pickReadableText(bgHex, preferredHex) {
    const bg = normalizeHex(bgHex);
    const pref = preferredHex ? normalizeHex(preferredHex) : "";
    const black = "#101216";
    const white = "#f4f7fb";
    if (pref && contrastRatio(pref, bg) >= 4.5) return pref;
    return contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white;
  }

  function ensureContrastAgainstBg(bgHex, preferredHex, minContrast, mode) {
    const bg = normalizeHex(bgHex);
    const pref = normalizeHex(preferredHex || pickReadableText(bg, ""));
    if (contrastRatio(pref, bg) >= minContrast) return pref;

    const [r, g, b] = hexToRgb(pref);
    const [h, s] = rgbToHsl(r, g, b);
    const towardLight = mode === "dark";

    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      const l = towardLight ? 0.55 + t * 0.4 : 0.45 - t * 0.4;
      const [nr, ng, nb] = hslToRgb(h, s * (towardLight ? 0.35 : 0.45), l);
      const cand = rgb01ToHex(nr, ng, nb);
      if (contrastRatio(cand, bg) >= minContrast) return cand;
    }
    return pickReadableText(bg, "");
  }

  function toneChromaMultiplier(tone) {
    switch (tone) {
      case "soft":
        return 0.82;
      case "muted":
        return 0.74;
      case "vivid":
        return 1.1;
      case "neon":
        return 1.18;
      case "luxury":
        return 0.88;
      case "minimal":
        return 0.7;
      default:
        return 1;
    }
  }

  function tuneTone(hex, tone) {
    const [r, g, b] = hexToRgb(normalizeHex(hex));
    const [h, s, l] = rgbToHsl(r, g, b);
    const [nr, ng, nb] = hslToRgb(h, clamp01(s * toneChromaMultiplier(tone)), l);
    return rgb01ToHex(nr, ng, nb);
  }

  function hashString(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function rand() {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickRankedVariant(ranked, topN, shuffleStep, rand) {
    if (!ranked.length) return null;
    if (!shuffleStep) return ranked[0];
    const span = Math.min(Math.max(1, topN), ranked.length);
    const idx = Math.floor(rand() * span) % span;
    return ranked[idx];
  }

  function pickBackgroundFromPalette(hexes, mode, shuffleStep, rand) {
    const withLum = hexes.map((hx) => ({ hx, lum: luminance(hx) }));
    withLum.sort((a, b) => a.lum - b.lum);
    if (!withLum.length) {
      const fallback = mode === "dark" ? "#0a0d12" : "#f8fafc";
      return { sourceHex: fallback, backgroundHex: fallback };
    }
    const ranked =
      mode === "dark"
        ? withLum.slice(0, Math.min(2, withLum.length))
        : withLum.slice(Math.max(0, withLum.length - 2)).reverse();
    const chosen = (pickRankedVariant(ranked, 2, shuffleStep, rand) || ranked[0]).hx;
    return {
      sourceHex: chosen,
      backgroundHex: mode === "dark" ? mixHex(chosen, "#05070b", 0.82) : mixHex(chosen, "#ffffff", 0.88),
    };
  }

  function pickBrightAccent(hexes, tone, shuffleStep, rand, excludedHexes = []) {
    if (!hexes.length) return "#ffcc00";
    const excluded = new Set(excludedHexes.map((h) => normalizeHex(h)));
    const ranked = [];
    for (const hx0 of hexes) {
      if (excluded.has(normalizeHex(hx0))) continue;
      const hx = tuneTone(hx0, tone);
      const [r, g, b] = hexToRgb(hx);
      const [, s, l] = rgbToHsl(r, g, b);
      const cur = s * 0.75 + l * 0.25;
      ranked.push({ hx, score: cur });
    }
    if (!ranked.length) return tuneTone(hexes[0], tone);
    ranked.sort((a, b) => b.score - a.score);
    const picked = pickRankedVariant(ranked, 3, shuffleStep, rand) || ranked[0];
    return picked.hx;
  }

  function pickFunBlockColor(hexes, bgHex, tone, shuffleStep, rand, excludedHexes = []) {
    const bg = normalizeHex(bgHex);
    const excluded = new Set(excludedHexes.map((h) => normalizeHex(h)));
    const ranked = [];
    for (const raw of hexes) {
      if (excluded.has(normalizeHex(raw))) continue;
      const hx = tuneTone(raw, tone);
      const [r, g, b] = hexToRgb(hx);
      const [h, s, l] = rgbToHsl(r, g, b);
      const bluePurpleBoost = h >= 205 && h <= 300 ? 0.38 : 0;
      const satScore = s;
      const lightnessFit = 1 - Math.abs(l - 0.52);
      const contrastFit = Math.min(1, contrastRatio(hx, bg) / 3.2);
      const cur = bluePurpleBoost + satScore * 0.34 + lightnessFit * 0.16 + contrastFit * 0.12;
      ranked.push({ hx, score: cur });
    }
    ranked.sort((a, b) => b.score - a.score);
    const picked = pickRankedVariant(ranked, 3, shuffleStep, rand);
    return (picked && picked.hx) || (hexes[0] ? tuneTone(hexes[0], tone) : "#4f46e5");
  }

  function pickSupportToneColor(hexes, bgHex, primaryHex, accentHex, tone, shuffleStep, rand, excludedHexes = []) {
    const bg = normalizeHex(bgHex);
    const pri = normalizeHex(primaryHex);
    const acc = normalizeHex(accentHex);
    const excluded = new Set([...excludedHexes, pri, acc].map((h) => normalizeHex(h)));
    const ranked = [];
    for (const raw of hexes) {
      const rawNorm = normalizeHex(raw);
      if (excluded.has(rawNorm)) continue;
      const hx = tuneTone(rawNorm, tone);
      const cBg = contrastRatio(hx, bg);
      const cPri = contrastRatio(hx, pri);
      const cAcc = contrastRatio(hx, acc);
      const [r, g, b] = hexToRgb(hx);
      const [, s, l] = rgbToHsl(r, g, b);
      const roleScore =
        Math.min(1, cBg / 2.1) * 0.34 + // should separate from background
        Math.min(1, cPri / 1.55) * 0.24 + // should differ from primary
        Math.min(1, cAcc / 1.45) * 0.22 + // should differ from accent/tag
        (1 - Math.abs(l - 0.5)) * 0.1 +
        s * 0.1;
      ranked.push({ hx, score: roleScore });
    }
    if (!ranked.length) return mixHex(pri, bg, 0.45);
    ranked.sort((a, b) => b.score - a.score);
    return (pickRankedVariant(ranked, 3, shuffleStep, rand) || ranked[0]).hx;
  }

  function complementaryTextSeed(bgHex, mode) {
    const [r, g, b] = hexToRgb(normalizeHex(bgHex));
    const [h] = rgbToHsl(r, g, b);
    const comp = (h + 180) % 360;
    const [nr, ng, nb] = hslToRgb(comp, mode === "dark" ? 0.14 : 0.18, mode === "dark" ? 0.93 : 0.12);
    return rgb01ToHex(nr, ng, nb);
  }

  function buildRuleDrivenTheme(row, moodId, mode, tone, options = {}) {
    const shuffleStep = options.shuffleStep || 0;
    const rawHexes = (row.p.colors || []).map((c) => normalizeHex(c.hex)).filter(Boolean);
    const seed = hashString(`${paletteStableKey(row.p)}|${moodId}|${tone}|${shuffleStep}`);
    const rand = mulberry32(seed);

    // Explicit mode toggle from user should override shuffle mode behavior.
    const appliedMode = options.forceMode
      ? options.forceMode
      : options.allowModeShuffle && shuffleStep > 0 && rand() > 0.52
        ? mode === "dark"
          ? "light"
          : "dark"
        : mode;

    const lockedCore = options.lockedCoreSelection || null;
    const bgPick = lockedCore
      ? {
          sourceHex: normalizeHex(lockedCore.backgroundSourceHex),
          backgroundHex: normalizeBackgroundFromSource(lockedCore.backgroundSourceHex, appliedMode),
        }
      : pickBackgroundFromPalette(rawHexes, appliedMode, shuffleStep, rand);
    const background = bgPick.backgroundHex;
    const textPrimary = ensureContrastAgainstBg(
      background,
      complementaryTextSeed(background, appliedMode),
      7,
      appliedMode,
    );
    const textSecondarySeed = mixHex(textPrimary, background, appliedMode === "dark" ? 0.36 : 0.48);
    const textMutedSeed = mixHex(textPrimary, background, appliedMode === "dark" ? 0.54 : 0.62);
    const textSecondary = ensureContrastAgainstBg(background, textSecondarySeed, 4.8, appliedMode);
    const textMuted = ensureContrastAgainstBg(background, textMutedSeed, 4.5, appliedMode);
    const block = lockedCore
      ? tuneTone(lockedCore.primaryHex, tone)
      : pickFunBlockColor(rawHexes, background, tone, shuffleStep, rand, [bgPick.sourceHex]);
    const tag = lockedCore
      ? tuneTone(lockedCore.tertiaryHex, tone)
      : pickBrightAccent(rawHexes, tone, shuffleStep, rand, [bgPick.sourceHex, block]);
    const secondaryTone = lockedCore
      ? tuneTone(lockedCore.secondaryHex, tone)
      : pickSupportToneColor(
          rawHexes,
          background,
          block,
          tag,
          tone,
          shuffleStep,
          rand,
          [bgPick.sourceHex],
        );
    const textOnBlock = pickReadableText(block, "");
    const textOnTag = pickReadableText(tag, "");
    const secondary = secondaryTone;
    const tertiary = tag;
    const surface = mixHex(background, appliedMode === "dark" ? "#171d24" : "#ffffff", appliedMode === "dark" ? 0.34 : 0.66);
    const surfaceElevated = mixHex(
      surface,
      appliedMode === "dark" ? "#232b34" : "#ffffff",
      appliedMode === "dark" ? 0.28 : 0.75,
    );
    const borderSubtle = mixHex(textPrimary, background, appliedMode === "dark" ? 0.88 : 0.9);
    const borderDefault = mixHex(textPrimary, background, appliedMode === "dark" ? 0.76 : 0.8);
    const link = ensureContrastAgainstBg(background, block, 4.5, appliedMode);
    const linkHover = ensureContrastAgainstBg(
      background,
      mixHex(link, appliedMode === "dark" ? "#ffffff" : "#0f1115", 0.18),
      4.5,
      appliedMode,
    );
    const focusRing = ensureContrastAgainstBg(background, mixHex(tag, appliedMode === "dark" ? "#ffffff" : "#0f1115", 0.2), 3, appliedMode);
    const footerBg = appliedMode === "dark" ? mixHex(background, "#000000", 0.34) : mixHex(background, "#0f1115", 0.88);
    const footerText = pickReadableText(footerBg, "");
    const footerLink = ensureContrastAgainstBg(footerBg, tag, 4.5, appliedMode === "dark" ? "dark" : "light");
    const [pr, pg, pb] = hexToRgb(block);
    const [, blockSat] = rgbToHsl(pr, pg, pb);
    const lightBgAltTint = blockSat > 0.5 ? 0.035 : 0.06;

    const cssVariables = {
      "--color-primary": block,
      "--color-secondary": secondary,
      "--color-tertiary": tertiary,
      "--color-supplementary": background,
      "--color-bg": background,
      "--color-bg-alt": mixHex(background, block, appliedMode === "dark" ? 0.14 : lightBgAltTint),
      "--color-surface": surface,
      "--color-surface-elevated": surfaceElevated,
      "--color-surface-muted": mixHex(surface, background, 0.5),
      "--color-overlay": appliedMode === "dark" ? "rgba(0,0,0,0.58)" : "rgba(20,22,24,0.42)",
      "--color-shadow": appliedMode === "dark" ? "rgba(0,0,0,0.38)" : "rgba(16,18,20,0.12)",
      "--color-text-primary": textPrimary,
      "--color-text-secondary": textSecondary,
      "--color-text-muted": textMuted,
      "--color-text-inverse": pickReadableText(textPrimary, ""),
      "--color-border-subtle": borderSubtle,
      "--color-border-default": borderDefault,
      "--color-divider": mixHex(borderSubtle, background, 0.4),
      "--color-link": link,
      "--color-link-hover": linkHover,
      "--color-link-visited": mixHex(link, tertiary, 0.4),
      "--color-button-primary-bg": block,
      "--color-button-primary-text": textOnBlock,
      "--color-button-primary-hover": mixHex(block, appliedMode === "dark" ? "#ffffff" : "#0f1115", 0.1),
      "--color-button-primary-pressed": mixHex(block, appliedMode === "dark" ? "#ffffff" : "#0f1115", 0.2),
      "--color-button-secondary-bg": mixHex(secondary, background, appliedMode === "dark" ? 0.28 : 0.74),
      "--color-button-secondary-text": pickReadableText(
        mixHex(secondary, background, appliedMode === "dark" ? 0.28 : 0.74),
        "",
      ),
      "--color-button-secondary-border": mixHex(secondary, background, appliedMode === "dark" ? 0.42 : 0.56),
      "--color-button-secondary-hover": mixHex(secondary, background, appliedMode === "dark" ? 0.18 : 0.68),
      "--color-button-ghost-text": link,
      "--color-button-ghost-hover-bg": mixHex(link, background, appliedMode === "dark" ? 0.74 : 0.86),
      "--color-focus-ring": focusRing,
      "--color-card-bg": mixHex(surface, block, appliedMode === "dark" ? 0.08 : 0.06),
      "--color-card-border": borderSubtle,
      "--color-tag-bg": tag,
      "--color-tag-text": textOnTag,
      "--color-tag-border": mixHex(tag, background, appliedMode === "dark" ? 0.48 : 0.58),
      "--color-decorative-soft": `${mixHex(secondary, background, appliedMode === "dark" ? 0.2 : 0.15)}33`,
      "--color-decorative-strong": `${mixHex(tertiary, background, appliedMode === "dark" ? 0.12 : 0.2)}66`,
      "--color-decorative-glow": appliedMode === "dark" ? `${mixHex(tag, "#ffffff", 0.22)}55` : "transparent",
      "--color-gradient-a": block,
      "--color-gradient-b": tertiary,
      "--color-success": appliedMode === "dark" ? "#7ed18a" : "#2e7d32",
      "--color-on-success": appliedMode === "dark" ? "#0e150f" : "#ffffff",
      "--color-success-bg": appliedMode === "dark" ? "#1e2b20" : "#e8f5e9",
      "--color-warning": appliedMode === "dark" ? "#ffc26d" : "#b26a00",
      "--color-on-warning": appliedMode === "dark" ? "#1f1406" : "#ffffff",
      "--color-warning-bg": appliedMode === "dark" ? "#32230d" : "#fff8e1",
      "--color-error": appliedMode === "dark" ? "#f2a6a0" : "#b3261e",
      "--color-on-error": appliedMode === "dark" ? "#220d0d" : "#ffffff",
      "--color-error-bg": appliedMode === "dark" ? "#351517" : "#ffebee",
      "--color-info": appliedMode === "dark" ? "#8ec5ff" : "#1769aa",
      "--color-on-info": appliedMode === "dark" ? "#0d1824" : "#ffffff",
      "--color-info-bg": appliedMode === "dark" ? "#122433" : "#e3f2fd",
      "--color-footer-bg": footerBg,
      "--color-footer-text": footerText,
      "--color-footer-link": footerLink,
    };

    return {
      mood: moodId,
      mode: appliedMode,
      tone,
      coreSelection: {
        backgroundSourceHex: bgPick.sourceHex,
        primaryHex: block,
        secondaryHex: secondaryTone,
        tertiaryHex: tag,
      },
      material: {
        primary: block,
        onPrimary: textOnBlock,
        primaryVariant: mixHex(block, appliedMode === "dark" ? "#ffffff" : "#0f1115", 0.16),
        secondary,
        onSecondary: pickReadableText(secondary, ""),
        secondaryVariant: mixHex(secondary, appliedMode === "dark" ? "#ffffff" : "#0f1115", 0.12),
        tertiary,
        onTertiary: pickReadableText(tertiary, ""),
        supplementary: background,
        onSupplementary: textPrimary,
        background,
        onBackground: textPrimary,
        surface,
        onSurface: pickReadableText(surface, textPrimary),
        error: cssVariables["--color-error"],
        onError: cssVariables["--color-on-error"],
      },
      frontend: {
        cssVariables,
        components: {
          footer: {
            bg: footerBg,
            text: footerText,
            link: footerLink,
          },
        },
      },
    };
  }

  function main() {
    const moodSelectEl = document.getElementById("mood-select");
    const moodDetailEl = document.getElementById("mood-detail");
    const panel = document.getElementById("control-panel");
    const toggle = document.getElementById("control-toggle");
    const typographyPanel = document.getElementById("typography-panel");
    const typographyToggle = document.getElementById("typography-toggle");
    const typographyListEl = document.getElementById("typography-list");
    const backdrop = document.getElementById("control-backdrop");
    const extraEl = document.getElementById("extra");
    const statusEl = document.getElementById("status");
    const errBanner = document.getElementById("err");

    const depsReady = bindPaletteApi();

    if (!toggle || !panel || !typographyPanel || !typographyToggle) {
      return;
    }

    const debouncedFindWhenOpen = debounce(() => {
      if (panel.classList.contains("is-open") && depsReady) void runFindPalettes();
    }, 320);

    function setOpenPanel(which) {
      const paletteOpen = which === "palette";
      const typeOpen = which === "typography";
      panel.classList.toggle("is-open", paletteOpen);
      typographyPanel.classList.toggle("is-open", typeOpen);
      if (backdrop) {
        const anyOpen = paletteOpen || typeOpen;
        backdrop.hidden = !anyOpen;
        backdrop.setAttribute("aria-hidden", anyOpen ? "false" : "true");
      }
      toggle.setAttribute("aria-expanded", paletteOpen ? "true" : "false");
      typographyToggle.setAttribute("aria-expanded", typeOpen ? "true" : "false");
      if (paletteOpen) {
        if (!depsReady) {
          if (statusEl) {
            statusEl.textContent =
              "Mood to Color scripts did not load (often a 404). Run a local server from the parent folder that contains BOTH “Mood to Color” and “Color Palette Switch Guidelines”, then open the URL in palette-switch-demo/README.md — port 9898.";
          }
          if (errBanner) {
            errBanner.hidden = false;
            errBanner.textContent =
              "Demo scripts failed to load. Use HTTP (not file://) with document root = your “Designer's pandora box” folder. In DevTools → Network, check for red 404s on paths like …/Mood%20to%20Color/website-theme-demo/mood-config.js";
          }
          return;
        }
        if (errBanner) errBanner.hidden = true;
        void runFindPalettes();
      } else if (typeOpen) {
        void ensureTypographyPairs().then((pairs) => {
          renderTypographyList(typographyListEl, pairs);
        });
      }
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !panel.classList.contains("is-open");
      setOpenPanel(open ? "palette" : null);
    });

    typographyToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !typographyPanel.classList.contains("is-open");
      setOpenPanel(open ? "typography" : null);
    });

    if (backdrop) {
      backdrop.addEventListener("click", () => setOpenPanel(null));
    }

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        (panel.classList.contains("is-open") || typographyPanel.classList.contains("is-open"))
      ) {
        setOpenPanel(null);
      }
    });

    const btnRefresh = document.getElementById("btn-refresh");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => {
        if (depsReady) void runFindPalettes();
      });
    }

    if (extraEl) {
      extraEl.addEventListener("input", debouncedFindWhenOpen);
    }

    const btnCopy = document.getElementById("btn-copy-css");
    if (btnCopy) {
      btnCopy.addEventListener("click", async () => {
        if (!lastTheme) {
          showToast("Apply a palette first");
          return;
        }
        const css = buildThemeCssExport(lastTheme);
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
        showToast("Copied CSS variables");
      });
    }

    if (!depsReady) {
      if (statusEl) {
        statusEl.textContent =
          "Open this menu for setup help. The Mood to Color JS must load from ../../Mood to Color/… (requires local server).";
      }
      return;
    }

    renderMoodSelect(moodSelectEl, moodDetailEl, selectedChipId, (next) => {
      selectedChipId = next;
      debouncedFindWhenOpen();
    });

    const modeEl = document.getElementById("theme-mode");
    const toneEl = document.getElementById("theme-tone");
    const reapply = () => {
      const target = aggregateTarget(selectedChipId, extraEl ? extraEl.value || "" : "");
      if (!target || !lastAppliedRow) return;
      const mode = modeEl && modeEl.value === "dark" ? "dark" : "light";
      const toneKeys =
        window.MoodWebsiteTheme && window.MoodWebsiteTheme.TONE_MODES
          ? Object.keys(window.MoodWebsiteTheme.TONE_MODES)
          : [];
      const tone = toneEl && toneKeys.includes(toneEl.value) ? toneEl.value : "clear";
      const st = document.getElementById("status");
      runApplySingleRow(lastAppliedRow, target, mode, tone, st);
    };

    if (modeEl) modeEl.addEventListener("change", reapply);
    if (toneEl) toneEl.addEventListener("change", reapply);

    if (statusEl) {
      statusEl.textContent =
        'Click “Mood & palettes” to load themes from Mood to Color — tap any row to apply instantly.';
    }

    ensurePalettes().catch((e) => {
      if (errBanner) {
        errBanner.hidden = false;
        errBanner.textContent = String(e.message || e);
      }
    });
    void ensureTypographyPairs().then((pairs) => renderTypographyList(typographyListEl, pairs));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
