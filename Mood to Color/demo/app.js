/**
 * Mood → palette demo — v2 mood engine in mood-engine-v2.js: OKLCH features, per-mood
 * identity gates, target/avoid hue Gaussians, harmony, bonuses/penalties, low text weight.
 * Mindful + Pinterest (`pinterest_colors_merged.json`); Pinterest uses keyword + color names for lemmas.
 */

const AXIS_KEYS = ["warmCool", "arousal", "valence", "sophistication", "grounding", "openness"];
const W_AXIS = 0.08;
/** Lemma hits in summary: tie-break only, must not override color judgment. */
const W_TEXT = 0.025;
const MIN_SCORE_REL_TO_TOP = 0.65;
/** Absolute floor (0–1) so weak pools do not surface; merged with per-source relative filter. */
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
/** Cap merged results so the page stays responsive with large Pinterest sets. */
const MAX_RESULTS_SHOWN = 72;
/** Drop palettes ≥ this similarity (0–1) to a higher-scoring one already kept (hue-sorted RGB distance). */
const PALETTE_NEAR_DUPLICATE_SIMILARITY = 0.86;
/** Same Pinterest keyword + colors this similar → keep only the stronger-scoring card. */
const PINTEREST_SAME_KEYWORD_SIMILARITY = 0.72;
/** Pairwise RGB distance (0–1); below = “too close” for internal redundancy checks. */
const INTRA_PALETTE_IDENTICAL_DIST = 0.004;
/** One pair this close = drop (two swatches are effectively the same role). */
const INTRA_PALETTE_NEAR_IDENTICAL_DIST = 0.011;
const INTRA_PALETTE_CLOSE_DIST = 0.036;
/** Pairs at or below this OKLab distance are dropped (near-duplicate swatches; all moods). */
const INTRA_PALETTE_TOO_SIMILAR_PAIR_OKLAB = 0.032;
const INTRA_OKLAB_NEAR_PAIR_DIST = 0.044;
const INTRA_OKLAB_NEAR_PAIR_MAX_FRAC = 0.32;
const INTRA_OKLAB_MIN_SEP = 0.041;
const INTRA_OKLAB_MAX_PAIRWISE = 0.054;
const INTRA_OKLAB_SOFT_PAIR = 0.058;
const INTRA_OKLAB_SOFT_FRAC = 0.58;
const INTRA_OKLAB_SOFT_MAXD = 0.13;
const INTRA_OKLAB_SPREAD_L = 0.048;
const INTRA_OKLAB_SPREAD_L_MAXD = 0.095;
/** Median “distance to nearest other swatch” — catches one loud accent + many near-twins. */
const INTRA_OKLAB_MEDIAN_NEAREST_MAX = 0.047;
/** Ignore largest ~this fraction of pairwise gaps when averaging (outlier pairs). */
const INTRA_OKLAB_TRIM_DROP_TOP = 0.14;
const INTRA_OKLAB_TRIM_MEAN_MAX = 0.036;
/** Muted palettes: low chroma spread + compressed lightness + no strong pair separation. */
const INTRA_OKLAB_SPREAD_C_MAX = 0.028;
const INTRA_OKLAB_SPREAD_C_L_MAX = 0.13;
const INTRA_OKLAB_SPREAD_C_PAIR_MAX = 0.145;
const ROW_PALETTE_OKLAB_DUP_MEAN = 0.073;
const INTRA_OKLAB_CHROMA_FOR_HUE = 0.034;
const INTRA_OKLAB_MAX_CHROMATIC_HUE_SPAN = 46;
/** After this many palettes scored, yield so the UI can paint (large libraries). */
const SCORE_YIELD_INTERVAL = 120;

const LIBRARY_LOADING_LINES = [
  "Unwrapping your color library…",
  "Fetching swatches from the cloud (the polite kind)…",
  "Almost there — big JSON, tiny patience medals…",
];

const MATCH_LOADING_LINES = [
  "Asking every palette how it feels about this mood…",
  "Color wheels spinning — ranking with kindness…",
  "Teaching pixels your vibe, one row at a time…",
  "Sorting chromatic contenders like a tiny awards show…",
  "Still here — your mood is a tough critic…",
  "Almost done — the slow ones are worth the wait…",
];

function pickLoadingLine(lines, salt) {
  const i = Math.abs(salt) % lines.length;
  return lines[i];
}

/** Mindful palettes first (by score), then Pinterest — up to `limit` cards. */
function prioritizeMindfulFirstByScore(rows, limit) {
  if (!rows.length) return [];
  const mindful = rows.filter((r) => paletteSource(r.p) !== "pinterest").sort((a, b) => b.score - a.score);
  const pinterest = rows.filter((r) => paletteSource(r.p) === "pinterest").sort((a, b) => b.score - a.score);
  const cap = Math.min(limit, rows.length);
  const out = [];
  for (const r of mindful) {
    if (out.length >= cap) break;
    out.push(r);
  }
  for (const r of pinterest) {
    if (out.length >= cap) break;
    out.push(r);
  }
  return out;
}

function paletteSource(p) {
  if (p.source === "pinterest") return "pinterest";
  if (p.source === "supplement") return "supplement";
  return "mindful";
}

function showCopyToast(message) {
  let el = document.getElementById("copy-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "copy-toast";
    el.className = "copy-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("copy-toast--visible");
  clearTimeout(showCopyToast._t);
  showCopyToast._t = setTimeout(() => el.classList.remove("copy-toast--visible"), 1800);
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 24 UI chips (lemmas feed caption boost; axes add a light consistency prior). */
const MOOD_CHIPS = [
  { id: "calm", label: "Calm", detail: "serene, still, quiet", lemmas: ["calm", "serene", "quiet"], axes: { warmCool: -0.25, arousal: 0.12, valence: 0.35, sophistication: 0.5, grounding: 0.25, openness: 0.55 } },
  { id: "trust", label: "Trust", detail: "dependable, secure, fintech", lemmas: ["trust", "dependable", "secure"], axes: { warmCool: -0.55, arousal: 0.25, valence: 0.2, sophistication: 0.55, grounding: 0.15, openness: 0.4 } },
  { id: "energy", label: "Energy", detail: "electric, vibrant, punchy", lemmas: ["energy", "vibrant", "dynamic"], axes: { warmCool: 0.35, arousal: 0.88, valence: 0.55, sophistication: 0.25, grounding: 0.1, openness: 0.65 } },
  { id: "play", label: "Playful", detail: "whimsical, fun, youthful", lemmas: ["playful", "whimsical", "fun"], axes: { warmCool: 0.1, arousal: 0.75, valence: 0.7, sophistication: 0.25, grounding: 0.2, openness: 0.75 } },
  { id: "lux", label: "Luxury", detail: "opulent, prestige, jewelry", lemmas: ["luxury", "opulent", "prestige"], axes: { warmCool: -0.1, arousal: 0.32, valence: 0.2, sophistication: 0.9, grounding: 0.15, openness: 0.25 } },
  { id: "earth", label: "Earth", detail: "organic, artisan, grounded", lemmas: ["earth", "organic", "natural"], axes: { warmCool: -0.05, arousal: 0.28, valence: 0.4, sophistication: 0.4, grounding: 0.88, openness: 0.55 } },
  { id: "melancholy", label: "Melancholy", detail: "somber, heavy, introspective", lemmas: ["melancholy", "somber", "sad"], axes: { warmCool: -0.35, arousal: 0.25, valence: -0.65, sophistication: 0.45, grounding: 0.25, openness: 0.15 } },
  { id: "joy", label: "Joy", detail: "cheerful, bright, upbeat", lemmas: ["joy", "cheerful", "bright"], axes: { warmCool: 0.25, arousal: 0.55, valence: 0.85, sophistication: 0.2, grounding: 0.2, openness: 0.8 } },
  { id: "romance", label: "Romance", detail: "intimate, love, bridal", lemmas: ["romantic", "love", "intimate"], axes: { warmCool: 0.22, arousal: 0.32, valence: 0.45, sophistication: 0.48, grounding: 0.12, openness: 0.55 } },
  { id: "clinical", label: "Clinical", detail: "sterile, precise, medical", lemmas: ["clinical", "sterile", "precise"], axes: { warmCool: -0.55, arousal: 0.15, valence: 0.18, sophistication: 0.65, grounding: 0.05, openness: 0.45 } },
  { id: "tech", label: "Tech", detail: "futuristic, digital, SaaS", lemmas: ["tech", "futuristic", "digital"], axes: { warmCool: -0.35, arousal: 0.45, valence: 0.25, sophistication: 0.55, grounding: 0.05, openness: 0.55 } },
  { id: "cozy", label: "Cozy", detail: "warm, welcoming, home", lemmas: ["cozy", "warm", "welcoming"], axes: { warmCool: 0.75, arousal: 0.35, valence: 0.4, sophistication: 0.3, grounding: 0.45, openness: 0.45 } },
  { id: "crisp", label: "Crisp cool", detail: "icy, airy, minimal cool", lemmas: ["crisp", "cool", "icy"], axes: { warmCool: -0.65, arousal: 0.28, valence: 0.05, sophistication: 0.65, grounding: 0.05, openness: 0.4 } },
  { id: "noir", label: "Noir", detail: "mystery, shadow, cinematic", lemmas: ["noir", "mysterious", "shadow"], axes: { warmCool: -0.4, arousal: 0.35, valence: -0.15, sophistication: 0.55, grounding: 0.2, openness: 0.18 } },
  { id: "nostalgia", label: "Nostalgia", detail: "vintage, retro, heritage", lemmas: ["nostalgia", "vintage", "retro"], axes: { warmCool: 0.2, arousal: 0.35, valence: 0.2, sophistication: 0.45, grounding: 0.45, openness: 0.35 } },
  { id: "pure", label: "Pure minimal", detail: "clean, simple, white space", lemmas: ["pure", "minimal", "clean"], axes: { warmCool: 0.0, arousal: 0.1, valence: 0.35, sophistication: 0.75, grounding: 0.1, openness: 0.55 } },
  { id: "urgent", label: "Urgent", detail: "sale, alert, deadline", lemmas: ["urgent", "sale", "alert"], axes: { warmCool: 0.55, arousal: 0.9, valence: 0.35, sophistication: 0.12, grounding: 0.1, openness: 0.65 } },
  { id: "ocean", label: "Ocean", detail: "coastal, aquatic, breeze", lemmas: ["ocean", "coastal", "aquatic"], axes: { warmCool: -0.5, arousal: 0.22, valence: 0.35, sophistication: 0.4, grounding: 0.25, openness: 0.55 } },
  { id: "forest", label: "Forest", detail: "deep green, hiking, canopy", lemmas: ["forest", "green", "woodland"], axes: { warmCool: -0.08, arousal: 0.35, valence: 0.45, sophistication: 0.35, grounding: 0.75, openness: 0.5 } },
  { id: "midnight", label: "Midnight", detail: "night, deep blue-black", lemmas: ["midnight", "night", "nocturnal"], axes: { warmCool: -0.45, arousal: 0.22, valence: -0.1, sophistication: 0.55, grounding: 0.15, openness: 0.15 } },
  { id: "dawn", label: "Dawn", detail: "hopeful morning, soft light", lemmas: ["dawn", "hopeful", "morning"], axes: { warmCool: 0.35, arousal: 0.28, valence: 0.45, sophistication: 0.42, grounding: 0.22, openness: 0.62 } },
  { id: "festival", label: "Festival", detail: "carnival, poster, maximal", lemmas: ["festival", "carnival", "party"], axes: { warmCool: 0.1, arousal: 0.88, valence: 0.85, sophistication: 0.18, grounding: 0.15, openness: 0.85 } },
  { id: "wedding", label: "Wedding", detail: "bridal, elegant romance", lemmas: ["wedding", "bridal", "marriage"], axes: { warmCool: 0.12, arousal: 0.28, valence: 0.65, sophistication: 0.62, grounding: 0.12, openness: 0.55 } },
  { id: "artisan", label: "Artisan", detail: "handmade, clay, craft fair", lemmas: ["artisan", "handmade", "craft"], axes: { warmCool: 0.32, arousal: 0.28, valence: 0.35, sophistication: 0.42, grounding: 0.72, openness: 0.45 } },
];

if (typeof window !== "undefined") {
  window.MOOD_CHIPS = MOOD_CHIPS;
  window.AXIS_KEYS = AXIS_KEYS;
  window.W_AXIS = W_AXIS;
  window.W_TEXT = W_TEXT;
}

function normalizeHex(hex) {
  if (hex == null || hex === "") return "";
  let h = String(hex).trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (h.length === 4 && /^#[0-9a-fA-F]{3}$/.test(h)) {
    const r = h[1],
      g = h[2],
      b = h[3];
    h = `#${r}${r}${g}${g}${b}${b}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h : "";
}

const MOOD_SCORE_CACHE_SCHEMA = 22;
const SCORE_CACHE_INTRA = "__intra__";
const SCORE_CACHE_BAD = "__bad__";

function paletteStableKey(p) {
  return `${paletteSource(p)}:${p.paletteNumber}`;
}

function moodExtraFingerprint(list) {
  if (!list || !list.length) return "0";
  let nMind = 0;
  const parts = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (paletteSource(p) !== "pinterest") nMind++;
    if (i < 2 || i >= list.length - 2) {
      const hx = (p.colors || [])
        .map((c) => normalizeHex(c.hex))
        .filter(Boolean)
        .sort()
        .join(",");
      parts.push(`${paletteSource(p)}:${p.paletteNumber}:${hx}`);
    }
  }
  return `${list.length}|${nMind}|${parts.join(";")}`;
}

function moodScoreStorageKey(identityStr, fp) {
  let h = 5381;
  const str = `${MOOD_SCORE_CACHE_SCHEMA}|${identityStr}|${fp}`;
  for (let i = 0; i < str.length; i++) h = (h << 5) + h + str.charCodeAt(i);
  return `m2cScores_${(h >>> 0).toString(36)}`;
}

function scoreMapCoversList(list, scoreMap) {
  if (!scoreMap || typeof scoreMap !== "object") return false;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const hexes = (p.colors || []).map((c) => normalizeHex(c.hex)).filter(Boolean);
    if (hexes.length < 4) continue;
    if (!Object.prototype.hasOwnProperty.call(scoreMap, paletteStableKey(p))) return false;
  }
  return true;
}

function loadMoodScoreCache(identityStr, fp) {
  try {
    const raw = sessionStorage.getItem(moodScoreStorageKey(identityStr, fp));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.v !== MOOD_SCORE_CACHE_SCHEMA || o.fp !== fp || o.identityStr !== identityStr) return null;
    return o.scores;
  } catch {
    return null;
  }
}

function saveMoodScoreCache(identityStr, fp, scores) {
  try {
    sessionStorage.setItem(
      moodScoreStorageKey(identityStr, fp),
      JSON.stringify({ v: MOOD_SCORE_CACHE_SCHEMA, fp, identityStr, scores }),
    );
  } catch (_) {}
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).replace("#", "");
  if (h.length !== 6) return [0, 0, 0];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

function rgbToHsl(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d < 1e-9) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h0;
  if (mx === r) h0 = ((g - b) / d + (g < b ? 6 : 0)) % 6;
  else if (mx === g) h0 = (b - r) / d + 2;
  else h0 = (r - g) / d + 4;
  return [h0 * 60, s, l];
}

function circularMeanHue(degrees) {
  const sx = degrees.reduce((a, h) => a + Math.cos((h * Math.PI) / 180), 0);
  const sy = degrees.reduce((a, h) => a + Math.sin((h * Math.PI) / 180), 0);
  return ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
}

function hueDelta(a, b) {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function hueInBand(h, lo, hi) {
  h = ((h % 360) + 360) % 360;
  lo = ((lo % 360) + 360) % 360;
  hi = ((hi % 360) + 360) % 360;
  if (lo <= hi) return h >= lo && h <= hi;
  return h >= lo || h <= hi;
}

function dominantHueClusterIndices(hs) {
  const n = hs.length;
  if (n <= 4) return hs.map((_, i) => i);
  const pts = hs.map((h) => [Math.cos((h * Math.PI) / 180), Math.sin((h * Math.PI) / 180)]);
  let bestJ = 1;
  let bestD = -1;
  for (let j = 1; j < n; j++) {
    const d = hueDelta(hs[0], hs[j]);
    if (d > bestD) {
      bestD = d;
      bestJ = j;
    }
  }
  let c1 = [...pts[0]];
  let c2 = [...pts[bestJ]];
  let g1 = [];
  let g2 = [];
  for (let it = 0; it < 8; it++) {
    g1 = [];
    g2 = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const d1 = (p[0] - c1[0]) ** 2 + (p[1] - c1[1]) ** 2;
      const d2 = (p[0] - c2[0]) ** 2 + (p[1] - c2[1]) ** 2;
      (d1 <= d2 ? g1 : g2).push(i);
    }
    if (!g1.length || !g2.length) return hs.map((_, i) => i);
    const mean = (ixs) => {
      const sx = ixs.reduce((a, i) => a + pts[i][0], 0) / ixs.length;
      const sy = ixs.reduce((a, i) => a + pts[i][1], 0) / ixs.length;
      return [sx, sy];
    };
    c1 = mean(g1);
    c2 = mean(g2);
  }
  if (g1.length === g2.length) return hs.map((_, i) => i);
  return g1.length > g2.length ? g1 : g2;
}

function swatchChromaWeight(s, l) {
  return Math.max(0, s) * (0.32 + 0.68 * Math.sqrt(Math.max(0.08, 1 - 2 * Math.abs(l - 0.5))));
}

function chromaticMassInBand(hsls, lo, hi, minS = 0.07) {
  let t = 0;
  for (const [h, s, l] of hsls) {
    if (s < minS) continue;
    if (!hueInBand(h, lo, hi)) continue;
    t += swatchChromaWeight(s, l);
  }
  return t;
}

function wineBurgundyMass(hsls) {
  let t = 0;
  for (const [h, s, l] of hsls) {
    if (s < 0.12) continue;
    if (!(hueInBand(h, 330, 360) || hueInBand(h, 0, 22))) continue;
    if (l < 0.52) t += swatchChromaWeight(s, l) * 1.15;
  }
  return t;
}

function earthMutedMass(hsls) {
  let t = 0;
  for (const [h, s, l] of hsls) {
    if (s > 0.58) continue;
    if (l < 0.14 || l > 0.88) continue;
    if (hueInBand(h, 18, 100)) t += swatchChromaWeight(s, l) * 1.05;
  }
  return t;
}

function deepShadowMass(hsls) {
  let t = 0;
  for (const [, s, l] of hsls) {
    if (l < 0.22) t += (0.15 + s) * (0.35 + 0.65 * (1 - l));
  }
  return t;
}

function whiteCreamMass(hsls) {
  let t = 0;
  for (const [, s, l] of hsls) {
    if (l > 0.88 && s < 0.38) t += 0.35 + 0.65 * (l - 0.88) * 5;
  }
  return t;
}

function goldChampagneMass(hsls) {
  let t = 0;
  for (const [h, s, l] of hsls) {
    if (l < 0.28 || l > 0.9) continue;
    if (hueInBand(h, 28, 62) && s > 0.12 && s < 0.72) t += swatchChromaWeight(s, l);
  }
  return t;
}

/**
 * True clearance hues: red, orange, punchy yellow, hot magenta-pink.
 * Deep violet (luxury) is excluded; dusty gold needs high saturation to count.
 */
function urgentWarmMass(hsls) {
  let t = 0;
  for (let [h, s, l] of hsls) {
    if (s < 0.1) continue;
    h = ((h % 360) + 360) % 360;
    const w = swatchChromaWeight(s, l);
    if (hueInBand(h, 258, 317)) continue;
    /* Magenta only when it reads as a bright signal, not deep wine-violet. */
    if (hueInBand(h, 0, 32) || hueInBand(h, 350, 360)) {
      t += w;
      continue;
    }
    if (h >= 318 && h <= 360 && l > 0.38 && s > 0.42) {
      t += w;
      continue;
    }
    if (hueInBand(h, 28, 58) && s >= 0.46) t += w * 0.92;
    if (hueInBand(h, 52, 98) && s >= 0.42) t += w * 0.55;
  }
  return t;
}

if (typeof window !== "undefined") {
  window.urgentWarmMass = urgentWarmMass;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function computeToneTags(hsls, meanS, maxS, minS, meanL, spreadL, minL, maxL) {
  const spreadS = Math.max(...hsls.map((x) => x[1])) - Math.min(...hsls.map((x) => x[1]));
  const contrast = clamp01(0.52 * spreadL + 0.48 * Math.min(1, spreadS * 1.2));
  const pastel = clamp01((meanL - 0.48) * 2.2) * clamp01((0.42 - meanS) * 3.5) * (meanS > 0.05 ? 1 : 0.35);
  const neon = clamp01((maxS - 0.62) * 4) * (meanL < 0.55 || spreadL > 0.32 ? 1 : 0.55);
  const muted = clamp01((0.38 - meanS) * 2.8) * (maxS < 0.48 ? 1 : 0.55);
  const deep = clamp01((0.52 - meanL) * 2) * (minL < 0.28 ? 1.15 : 1) * 0.9;
  const airy = clamp01((meanL - 0.55) * 2.4) * clamp01((0.55 - spreadL * 0.9) * 1.2);
  const sharp = clamp01((contrast - 0.38) * 2.2) * (maxS > 0.38 ? 1 : 0.65);
  const bright = clamp01((meanS - 0.38) * 2) * clamp01((meanL - 0.45) * 1.8);
  const earthy = clamp01(earthMutedMass(hsls) * 1.15);
  let metallic = 0;
  for (const [h, s, l] of hsls) {
    if (hueInBand(h, 32, 58) && s > 0.18 && s < 0.62 && l > 0.38 && l < 0.82) metallic += 0.22;
    if (l > 0.78 && s < 0.18 && hueInBand(h, 200, 270)) metallic += 0.12;
  }
  metallic = clamp01(metallic);
  const monochrome = clamp01(1 - spreadS * 2.2) * (meanS < 0.25 ? 1 : 0.55);
  const maximal = clamp01((meanS * 0.45 + contrast * 0.55 - 0.35) * 2.2);
  const soft = clamp01(0.55 * pastel + 0.35 * (1 - sharp) * meanL + 0.25 * (1 - neon));
  return {
    pastel,
    neon,
    muted,
    deep,
    airy,
    sharp,
    bright,
    earthy,
    metallic,
    monochrome,
    maximal,
    contrast,
    soft,
  };
}

/** Coarse hue family for dominant / secondary / accent (spec §1). */
function hueFamilyName(deg) {
  const h = ((deg % 360) + 360) % 360;
  if (h < 16 || h >= 352) return "red";
  if (h < 44) return "orange";
  if (h < 95) return "yellow";
  if (h < 150) return "green";
  if (h < 198) return "teal";
  if (h < 258) return "blue";
  if (h < 302) return "purple";
  if (h < 340) return "pink";
  return "red";
}

/** When JSON has no per-swatch name (Mindful), derive a short label from hue/lightness. */
function swatchDisplayName(hex) {
  const hx = normalizeHex(hex);
  if (!hx) return "—";
  const [r, g, b] = hexToRgb(hx);
  const [hd, s, l] = rgbToHsl(r, g, b);
  const H = ((hd % 360) + 360) % 360;
  if (s < 0.08) {
    if (l > 0.92) return "White";
    if (l < 0.1) return "Black";
    if (l > 0.78) return "Light grey";
    if (l < 0.32) return "Dark grey";
    return "Grey";
  }
  const fam = hueFamilyName(H);
  let prefix = "";
  if (l > 0.72) prefix = "Light ";
  else if (l < 0.32) prefix = "Deep ";
  else if (s > 0.72) prefix = "Vivid ";
  const core = (prefix + fam).trim();
  return core.charAt(0).toUpperCase() + core.slice(1);
}

/** Canonical order so two palettes compare swatch-to-swatch consistently (keeps duplicate hexes). */
function sortHexesForPaletteCompare(hexes) {
  const clean = hexes.map(normalizeHex).filter(Boolean);
  return clean.sort((ha, hb) => {
    const [ra, ga, ba] = hexToRgb(ha);
    const [rb, gb, bb] = hexToRgb(hb);
    const [hA, , lA] = rgbToHsl(ra, ga, ba);
    const [hB, , lB] = rgbToHsl(rb, gb, bb);
    const Ah = ((hA % 360) + 360) % 360;
    const Bh = ((hB % 360) + 360) % 360;
    if (Math.abs(Ah - Bh) > 0.5) return Ah - Bh;
    return lA - lB;
  });
}

function rgbPairNormDistHex(ha, hb) {
  const [ra, ga, ba] = hexToRgb(ha);
  const [rb, gb, bb] = hexToRgb(hb);
  return Math.sqrt((ra - rb) ** 2 + (ga - gb) ** 2 + (ba - bb) ** 2) / Math.sqrt(3);
}

function linearSrgb(u) {
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
}

function rgbToOklab01(r, g, b) {
  const lr = linearSrgb(r);
  const lg = linearSrgb(g);
  const lb = linearSrgb(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function oklabDist(labA, labB) {
  return Math.hypot(labA[0] - labB[0], labA[1] - labB[1], labA[2] - labB[2]);
}

function oklabGreedyDistinctCount(labs, minSep) {
  const picked = [];
  for (const lab of labs) {
    let farEnough = true;
    for (const p of picked) {
      if (oklabDist(lab, p) < minSep) {
        farEnough = false;
        break;
      }
    }
    if (farEnough) picked.push(lab);
  }
  return picked.length;
}

function oklabChroma(lab) {
  return Math.hypot(lab[1], lab[2]);
}

function oklabHueDegrees(lab) {
  return ((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360;
}

function hexesToOklabs(hexes) {
  return hexes
    .map((h) => normalizeHex(h))
    .filter(Boolean)
    .map((h) => {
      const [r, g, b] = hexToRgb(h);
      return rgbToOklab01(r, g, b);
    });
}

/**
 * Light, token-friendly stacks: airy neutral ladders or white + 1–2 cool accents.
 * Intentionally soft in OKLab — skip harsh “spread” rejection so pure / clinical pools keep options.
 */
function intraPaletteLightNeutralSystemOK(hexes) {
  const list = hexes.map(normalizeHex).filter(Boolean);
  const n = list.length;
  if (n < 4) return false;
  const labs = hexesToOklabs(list);
  if (labs.length !== n) return false;
  let maxL = -1;
  let maxD = 0;
  for (let i = 0; i < n; i++) {
    maxL = Math.max(maxL, labs[i][0]);
    for (let j = i + 1; j < n; j++) maxD = Math.max(maxD, oklabDist(labs[i], labs[j]));
  }
  if (maxL < 0.86 || maxD < 0.041) return false;
  const chromas = labs.map(oklabChroma);
  const spreadC = Math.max(...chromas) - Math.min(...chromas);
  const accentCt = chromas.filter((c) => c >= 0.055).length;
  const softCt = chromas.filter((c) => c < 0.075).length;
  const medNear = oklabMedianNearestMinDistance(labs);
  if (accentCt <= 1 && spreadC < 0.095 && softCt >= n - 1 && medNear >= 0.027) return true;
  if (
    maxL >= 0.885 &&
    accentCt <= 2 &&
    spreadC < 0.17 &&
    softCt >= n - accentCt &&
    medNear >= 0.025
  ) {
    const hiLabs = labs.filter((lab, i) => chromas[i] >= 0.052);
    if (
      hiLabs.length === 0 ||
      hiLabs.every((lab) => {
        const deg = oklabHueDegrees(lab);
        return deg >= 175 && deg <= 285;
      })
    )
      return true;
  }
  return false;
}

function paletteMeanMinOklabDistance(hexesA, hexesB) {
  const labsA = hexesToOklabs(hexesA);
  const labsB = hexesToOklabs(hexesB);
  if (!labsA.length || !labsB.length) return 1;
  function meanNearest(from, to) {
    let sum = 0;
    for (const la of from) {
      let m = Infinity;
      for (const lb of to) m = Math.min(m, oklabDist(la, lb));
      sum += m;
    }
    return sum / from.length;
  }
  return (meanNearest(labsA, labsB) + meanNearest(labsB, labsA)) / 2;
}

function intraPaletteAnalogousHueMud(labs, n, spreadL, spreadC) {
  const hues = [];
  for (const lab of labs) {
    if (oklabChroma(lab) < INTRA_OKLAB_CHROMA_FOR_HUE) continue;
    hues.push(oklabHueDegrees(lab));
  }
  if (hues.length < 3) return false;
  let maxSpan = 0;
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      maxSpan = Math.max(maxSpan, hueDelta(hues[i], hues[j]));
    }
  }
  return (
    n >= 5 &&
    maxSpan < INTRA_OKLAB_MAX_CHROMATIC_HUE_SPAN &&
    spreadL < 0.28 &&
    (spreadC < 0.09 || maxSpan < 38)
  );
}

function oklabMedianNearestMinDistance(labs) {
  const n = labs.length;
  const mins = [];
  for (let i = 0; i < n; i++) {
    let m = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      m = Math.min(m, oklabDist(labs[i], labs[j]));
    }
    mins.push(m);
  }
  mins.sort((a, b) => a - b);
  return mins[Math.floor(mins.length / 2)];
}

function oklabTrimmedMeanPairwise(labs, dropFracTop) {
  const n = labs.length;
  const dists = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) dists.push(oklabDist(labs[i], labs[j]));
  }
  if (!dists.length) return 0;
  dists.sort((a, b) => b - a);
  const drop = Math.min(dists.length - 1, Math.max(1, Math.ceil(dists.length * dropFracTop)));
  const tail = dists.slice(drop);
  if (!tail.length) return dists[dists.length - 1];
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

/** True if swatches cluster in OKLab (poor internal contrast for UI / theme roles). */
function intraPaletteInsufficientUsableContrast(hexes) {
  const list = hexes.map(normalizeHex).filter(Boolean);
  const n = list.length;
  if (n < 3) return false;
  if (intraPaletteLightNeutralSystemOK(list)) return false;
  const labs = list.map((h) => {
    const [r, g, b] = hexToRgb(h);
    return rgbToOklab01(r, g, b);
  });
  let maxD = 0;
  let minL = 2;
  let maxL = -1;
  let softClose = 0;
  let pairs = 0;
  for (let i = 0; i < n; i++) {
    const [L] = labs[i];
    minL = Math.min(minL, L);
    maxL = Math.max(maxL, L);
    for (let j = i + 1; j < n; j++) {
      const d = oklabDist(labs[i], labs[j]);
      maxD = Math.max(maxD, d);
      pairs++;
      if (d < INTRA_OKLAB_SOFT_PAIR) softClose++;
    }
  }
  const spreadL = maxL - minL;
  const fracSoft = pairs ? softClose / pairs : 0;
  const needDistinct = n >= 6 ? 4 : n >= 4 ? 3 : 2;
  const distinct = oklabGreedyDistinctCount(labs, INTRA_OKLAB_MIN_SEP);
  const chromas = labs.map(oklabChroma);
  const spreadC = Math.max(...chromas) - Math.min(...chromas);
  const medNearest = oklabMedianNearestMinDistance(labs);
  const trimMean = oklabTrimmedMeanPairwise(labs, INTRA_OKLAB_TRIM_DROP_TOP);
  if (maxD < INTRA_OKLAB_MAX_PAIRWISE) return true;
  if (distinct < needDistinct) return true;
  if (spreadL < INTRA_OKLAB_SPREAD_L && maxD < INTRA_OKLAB_SPREAD_L_MAXD) return true;
  if (n >= 5 && fracSoft >= INTRA_OKLAB_SOFT_FRAC && maxD < INTRA_OKLAB_SOFT_MAXD) return true;
  if (n >= 5 && medNearest < INTRA_OKLAB_MEDIAN_NEAREST_MAX) return true;
  if (n >= 5 && trimMean < INTRA_OKLAB_TRIM_MEAN_MAX) return true;
  if (n >= 5 && spreadC < INTRA_OKLAB_SPREAD_C_MAX && spreadL < INTRA_OKLAB_SPREAD_C_L_MAX && maxD < INTRA_OKLAB_SPREAD_C_PAIR_MAX) {
    return true;
  }
  if (intraPaletteAnalogousHueMud(labs, n, spreadL, spreadC)) return true;
  return false;
}

function intraPaletteExcessiveNearPairs(hexes) {
  const list = hexes.map(normalizeHex).filter(Boolean);
  if (intraPaletteLightNeutralSystemOK(list)) return false;
  const labs = hexesToOklabs(hexes);
  const n = labs.length;
  if (n < 5) return false;
  let close = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      total++;
      if (oklabDist(labs[i], labs[j]) < INTRA_OKLAB_NEAR_PAIR_DIST) close++;
    }
  }
  return total > 0 && close / total >= INTRA_OKLAB_NEAR_PAIR_MAX_FRAC;
}

/** No swatch reaches a light enough OKLab L to anchor surfaces, body text, or balanced light/dark roles. */
function intraPaletteAllShadowNoLightAnchor(hexes) {
  const labs = hexesToOklabs(hexes);
  if (labs.length < 4) return false;
  let maxL = -1;
  for (const lab of labs) maxL = Math.max(maxL, lab[0]);
  return maxL < 0.395;
}

/**
 * Poster-style neon: many saturated brights, almost no true neutrals — poor for website tokens
 * (no calm base, no readable hierarchy).
 */
function intraPaletteNeonPosterUnbalanced(hexes) {
  const labs = hexesToOklabs(hexes);
  const n = labs.length;
  if (n < 5) return false;
  let maxL = -1;
  let minL = 2;
  let vividBright = 0;
  let luminousBand = 0;
  let neutrals = 0;
  for (const lab of labs) {
    const L = lab[0];
    const c = oklabChroma(lab);
    maxL = Math.max(maxL, L);
    minL = Math.min(minL, L);
    if (c < 0.042) neutrals++;
    if (c > 0.118 && L > 0.6) vividBright++;
    if (L > 0.68 && c > 0.086) luminousBand++;
  }
  const spreadL = maxL - minL;
  if (vividBright >= Math.max(4, n - 1) && neutrals <= 1) return true;
  if (vividBright >= 4 && neutrals <= 1 && spreadL < 0.5 && minL > 0.22) return true;
  if (vividBright >= 4 && neutrals <= 1 && minL > 0.26 && maxL > 0.82) return true;
  if (luminousBand >= 4 && neutrals <= 1 && minL > 0.22 && spreadL < 0.58) return true;
  return false;
}

function intraPaletteUnusableForWeb(hexes) {
  return (
    intraPaletteTooRedundant(hexes) ||
    intraPaletteInsufficientUsableContrast(hexes) ||
    intraPaletteExcessiveNearPairs(hexes) ||
    intraPaletteAllShadowNoLightAnchor(hexes) ||
    intraPaletteNeonPosterUnbalanced(hexes)
  );
}

/**
 * True if the palette has redundant swatches: any pair too close in OKLab (perceptual dup),
 * identical/near-identical RGB-normalized hex, or ≥2 pairs of very similar RGB colors.
 */
function intraPaletteTooRedundant(hexes) {
  const list = hexes.map(normalizeHex).filter(Boolean);
  if (list.length < 2) return false;
  const labs = list.map((h) => {
    const [r, g, b] = hexToRgb(h);
    return rgbToOklab01(r, g, b);
  });
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) {
      if (oklabDist(labs[i], labs[j]) <= INTRA_PALETTE_TOO_SIMILAR_PAIR_OKLAB) return true;
    }
  }
  let closePairs = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const d = rgbPairNormDistHex(list[i], list[j]);
      if (d < INTRA_PALETTE_IDENTICAL_DIST) return true;
      if (d < INTRA_PALETTE_NEAR_IDENTICAL_DIST) return true;
      if (d < INTRA_PALETTE_CLOSE_DIST) closePairs++;
    }
  }
  return closePairs >= 2;
}

/** 1 = identical colors (after canonical pairing), ~0.5 = clearly different. */
function paletteSimilarity01(hexesA, hexesB) {
  const a = sortHexesForPaletteCompare(hexesA);
  const b = sortHexesForPaletteCompare(hexesB);
  if (a.length < 4 || b.length < 4 || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = rgbPairNormDistHex(a[i], b[i]);
    sum += d;
  }
  const meanD = sum / a.length;
  return 1 - Math.min(1, meanD / 0.22);
}

function pinterestKeywordNorm(p) {
  if (p.source !== "pinterest") return "";
  const kw = p.pinMeta && p.pinMeta.keyword != null ? String(p.pinMeta.keyword) : "";
  return kw.trim().toLowerCase();
}

function pinterestDisplayTitleNorm(p) {
  if (p.source !== "pinterest") return "";
  return String(p.displayTitle || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function rowPaletteHexes(row) {
  const colors = row && row.p && row.p.colors ? row.p.colors : [];
  return colors.map((c) => normalizeHex(c.hex)).filter(Boolean);
}

function dedupeRowsByPaletteSimilarity(rows, simThreshold) {
  const kept = [];
  for (const row of rows) {
    const hx = rowPaletteHexes(row);
    if (hx.length < 4) continue;
    const kw = pinterestKeywordNorm(row.p);
    const title1 = pinterestDisplayTitleNorm(row.p);
    let dup = false;
    for (const k of kept) {
      const hx2 = rowPaletteHexes(k);
      const sim = paletteSimilarity01(hx, hx2);
      if (sim >= simThreshold) {
        dup = true;
        break;
      }
      const kw2 = pinterestKeywordNorm(k.p);
      if (kw && kw === kw2 && sim >= PINTEREST_SAME_KEYWORD_SIMILARITY) {
        dup = true;
        break;
      }
      if (paletteMeanMinOklabDistance(hx, hx2) < ROW_PALETTE_OKLAB_DUP_MEAN) {
        dup = true;
        break;
      }
      const title2 = pinterestDisplayTitleNorm(k.p);
      if (title1 && title1 === title2) {
        dup = true;
        break;
      }
    }
    if (!dup) kept.push(row);
  }
  return kept;
}

function computeHueRoles(hsls) {
  const idx = hsls
    .map((_, i) => i)
    .sort((a, b) => {
      const [, sa, la] = hsls[a];
      const [, sb, lb] = hsls[b];
      return swatchChromaWeight(sb, lb) - swatchChromaWeight(sa, la);
    });
  const dom = idx[0];
  const sec = idx[Math.min(1, idx.length - 1)];
  const acc = idx[Math.min(2, idx.length - 1)];
  const dh = ((hsls[dom][0] % 360) + 360) % 360;
  return {
    dominantHueDeg: dh,
    dominantFamily: hueFamilyName(dh),
    secondaryFamily: hueFamilyName(hsls[sec][0]),
    accentFamily: hueFamilyName(hsls[acc][0]),
    neutralFrac: hsls.filter(([, s]) => s < 0.08).length / hsls.length,
    darkFrac: hsls.filter(([, , l]) => l < 0.2).length / hsls.length,
    whiteFrac: hsls.filter(([, s, l]) => l > 0.88 && s < 0.35).length / hsls.length,
  };
}

/**
 * Full palette analysis: chromatic masses (whole palette), tone tags, contrast,
 * hue roles (dominant / secondary / accent families), and axis fields from dominant cluster.
 */
function analyzePalette(hexes) {
  const clean = hexes.map(normalizeHex).filter(Boolean);
  if (clean.length < 4) return null;
  const hexList = [...clean];
  while (hexList.length < 6) hexList.push(hexList[hexList.length - 1]);

  const hsls = hexList.map((hx) => {
    const [r, g, b] = hexToRgb(hx);
    return rgbToHsl(r, g, b);
  });
  const hs = hsls.map((x) => x[0]);
  const ss = hsls.map((x) => x[1]);
  const ls = hsls.map((x) => x[2]);
  const meanS = ss.reduce((a, b) => a + b, 0) / ss.length;
  const meanL = ls.reduce((a, b) => a + b, 0) / ls.length;
  const maxS = Math.max(...ss);
  const minS = Math.min(...ss);
  const maxL = Math.max(...ls);
  const minL = Math.min(...ls);
  const spreadL = maxL - minL;

  const domIdx = dominantHueClusterIndices(hs);
  const domHs = domIdx.map((i) => hs[i]);
  const hueDeg = circularMeanHue(domHs);
  const warmCool = domHs.reduce((a, h) => a + Math.cos((h * Math.PI) / 180), 0) / domHs.length;
  const arousal = Math.min(1, 0.55 * meanS + 0.45 * Math.min(1, spreadL * 1.8));
  const valence = Math.max(-1, Math.min(1, (meanL - 0.45) * 2.2 + (meanS - 0.35) * 0.8));
  const sophistication = Math.max(0, Math.min(1, 1 - meanS * 0.85 + (0.25 - Math.abs(meanL - 0.55)) * 0.4));
  let grounding = 0;
  for (const i of domIdx) {
    const [h, s, l] = hsls[i];
    if (h % 360 >= 70 && h % 360 <= 150 && s < 0.55) grounding += 0.2;
    if (h % 360 >= 20 && h % 360 <= 70 && l < 0.55) grounding += 0.12;
  }
  grounding = Math.min(1, grounding);
  const openness = Math.max(0, Math.min(1, 0.55 * meanL + 0.35 * (1 - meanS * 0.6)));

  const tags = computeToneTags(hsls, meanS, maxS, minS, meanL, spreadL, minL, maxL);
  const satVibrancy = clamp01(0.48 * maxS + 0.52 * meanS);

  const m = {
    warmAlert: chromaticMassInBand(hsls, 0, 78) + chromaticMassInBand(hsls, 330, 360) + 0.45 * chromaticMassInBand(hsls, 295, 330),
    hotPink: chromaticMassInBand(hsls, 300, 360) + chromaticMassInBand(hsls, 0, 28),
    yellowJoy: chromaticMassInBand(hsls, 42, 102),
    orangeEnergy: chromaticMassInBand(hsls, 12, 55),
    pinkRose: chromaticMassInBand(hsls, 305, 360) + chromaticMassInBand(hsls, 0, 32),
    purpleJewel: chromaticMassInBand(hsls, 255, 325),
    blueTrust: chromaticMassInBand(hsls, 198, 268),
    tealOcean: chromaticMassInBand(hsls, 158, 218),
    cyanClinical: chromaticMassInBand(hsls, 175, 215),
    greenForest: chromaticMassInBand(hsls, 88, 158),
    goldChampagne: goldChampagneMass(hsls),
    wineBurgundy: wineBurgundyMass(hsls),
    earthMuted: earthMutedMass(hsls),
    deepShadow: deepShadowMass(hsls),
    whiteCream: whiteCreamMass(hsls),
  };

  const domSamples = domIdx.map((i) => ({
    h: ((hs[i] % 360) + 360) % 360,
    s: ss[i],
    l: ls[i],
  }));

  const hueRoles = computeHueRoles(hsls);

  const moodV2 =
    typeof window !== "undefined" && typeof window.buildPaletteMoodFeatures === "function"
      ? window.buildPaletteMoodFeatures(hexList, hsls, tags, warmCool)
      : { features: null, swatches: [], harmony: {}, tagSignals: {}, hueEntropy: 0 };

  return {
    hsls,
    hueRoles,
    hueDeg,
    warmCool,
    arousal,
    valence,
    sophistication,
    grounding,
    openness,
    meanS,
    meanL,
    maxS,
    minS,
    spreadL,
    minL,
    maxL,
    satVibrancy,
    tags,
    m,
    domSamples,
    _dominantCount: domIdx.length,
    features: moodV2.features,
    swatches: moodV2.swatches,
    harmony: moodV2.harmony,
    tagSignals: moodV2.tagSignals,
    hueEntropy: moodV2.hueEntropy,
  };
}


function buildUnifiedPaletteList(mindfulJson, pinterestJson, supplementJson) {
  const out = [];
  if (mindfulJson?.palettes) {
    for (const p of mindfulJson.palettes) {
      const colors = (p.colors || []).map((c) => ({ hex: normalizeHex(c.hex) })).filter((c) => c.hex);
      if (colors.length < 4) continue;
      const hexPre = colors.map((c) => c.hex);
      if (intraPaletteUnusableForWeb(hexPre)) continue;
      while (colors.length < 6) colors.push({ hex: colors[colors.length - 1].hex });
      out.push({
        source: "mindful",
        paletteNumber: p.paletteNumber,
        paletteSummary: p.paletteSummary || "",
        displayTitle: `Mindful #${p.paletteNumber}`,
        colors,
      });
    }
  }
  if (supplementJson?.palettes?.length) {
    for (const p of supplementJson.palettes) {
      const colors = (p.colors || []).map((c) => ({ hex: normalizeHex(c.hex) })).filter((c) => c.hex);
      if (colors.length < 4) continue;
      const hexPre = colors.map((c) => c.hex);
      if (intraPaletteUnusableForWeb(hexPre)) continue;
      while (colors.length < 6) colors.push({ hex: colors[colors.length - 1].hex });
      out.push({
        source: "supplement",
        paletteNumber: p.paletteNumber,
        paletteSummary: p.paletteSummary || "",
        displayTitle: p.displayTitle || `Curated #${p.paletteNumber}`,
        colors,
      });
    }
  }
  const pins = pinterestJson?.palettes_by_image;
  if (Array.isArray(pins)) {
    pins.forEach((entry, idx) => {
      const cols = (entry.colors || [])
        .map((c) => ({ hex: normalizeHex(c.hex), name: c.name ? String(c.name) : "" }))
        .filter((c) => c.hex);
      if (cols.length < 4) return;
      const hexPre = cols.map((c) => c.hex);
      if (intraPaletteUnusableForWeb(hexPre)) return;
      while (cols.length < 6) {
        const L = cols[cols.length - 1];
        cols.push({ hex: L.hex, name: L.name });
      }
      const keyword = entry.keyword ? String(entry.keyword) : "";
      const nameStr = cols
        .map((c) => c.name)
        .filter(Boolean)
        .join(" ");
      const summary = [keyword, nameStr].filter(Boolean).join(" · ");
      const title = keyword || entry.image_file || `Pinterest ${idx + 1}`;
      out.push({
        source: "pinterest",
        paletteNumber: 10000 + idx,
        paletteSummary: summary,
        displayTitle: title,
        colors: cols,
        pinMeta: { image_file: entry.image_file, keyword },
      });
    });
  }
  return out;
}

function aggregateTarget(selectedChipId, extraText) {
  const chip = selectedChipId ? MOOD_CHIPS.find((c) => c.id === selectedChipId) : null;
  const extraLemmas = extraText
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1);
  if (!chip) return null;
  const lemmas = [...new Set([...chip.lemmas, ...extraLemmas])];
  return { moodId: chip.id, lemmas };
}

function moodScoreIdentity(target) {
  return JSON.stringify({ m: target.moodId, l: [...target.lemmas].sort() });
}

function renderChips(container, selectedChipId, onPick) {
  container.innerHTML = "";
  for (const c of MOOD_CHIPS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.id = c.id;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", c.id === selectedChipId ? "true" : "false");
    b.innerHTML = `<span>${c.label}</span><span class="detail">${c.detail}</span>`;
    b.addEventListener("click", () => {
      const next = c.id === selectedChipId ? null : c.id;
      onPick(next);
    });
    container.appendChild(b);
  }
}

const COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

function renderSwatchRow(colors) {
  const block = document.createElement("div");
  block.className = "palette-swatch-block";
  const sw = document.createElement("div");
  sw.className = "swatches";
  for (const c of colors || []) {
    const hex = normalizeHex(c.hex);
    if (!hex) continue;
    const rawName = c.name ? String(c.name).trim() : "";
    const labelName = rawName || swatchDisplayName(hex);
    const cell = document.createElement("div");
    cell.className = "swatch-cell";
    const fill = document.createElement("div");
    fill.className = "swatch-fill";
    fill.style.background = hex;
    fill.title = `${labelName} (${hex.toUpperCase()})`;
    cell.appendChild(fill);
    const nm = document.createElement("div");
    nm.className = "swatch-label-name";
    nm.textContent = labelName;
    nm.title = `${labelName} — ${hex.toUpperCase()}`;
    cell.appendChild(nm);
    sw.appendChild(cell);
  }
  block.appendChild(sw);
  return block;
}

function fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleRowsWithinMatchBands(rows, poolMaxScore) {
  const cap = poolMaxScore > 1e-9 ? poolMaxScore : 1;
  const buckets = new Map();
  for (const r of rows) {
    const pct = Math.min(100, Math.round((r.score / cap) * 100));
    const bandTop = Math.min(100, Math.ceil(pct / 10) * 10);
    if (!buckets.has(bandTop)) buckets.set(bandTop, []);
    buckets.get(bandTop).push(r);
  }
  const out = [];
  const sortedBands = Array.from(buckets.keys()).sort((a, b) => b - a);
  for (const b of sortedBands) out.push(...fisherYatesShuffle(buckets.get(b)));
  return out;
}

function renderResults(container, rows, poolMaxScore) {
  container.innerHTML = "";
  for (const row of rows) {
    const { p } = row;
    const card = document.createElement("article");
    card.className = "card";
    const hexes = (p.colors || []).map((c) => normalizeHex(c.hex)).filter(Boolean);
    const textToCopy = (p.colors || [])
      .map((c) => {
        const hx = normalizeHex(c.hex);
        if (!hx) return "";
        const rawName = c.name ? String(c.name).trim() : "";
        const label = rawName || swatchDisplayName(hx);
        return `${label}, Hex code ${hx.toUpperCase()}`;
      })
      .filter(Boolean)
      .join("\n");

    const head = document.createElement("div");
    head.className = "card-head";
    const top = document.createElement("div");
    top.className = "card-head-top";
    const nameLine = document.createElement("div");
    nameLine.className = "card-palette-name";
    const nameRaw =
      p.source === "pinterest"
        ? (p.pinMeta && p.pinMeta.keyword) || p.displayTitle || `Palette #${p.paletteNumber}`
        : p.source === "supplement"
          ? p.displayTitle || `Curated #${p.paletteNumber}`
          : p.displayTitle || `Palette #${p.paletteNumber}`;
    nameLine.textContent = nameRaw;
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "card-copy-all";
    copyBtn.innerHTML = COPY_ICON_SVG;
    copyBtn.title = "Copy each swatch as: Name, Hex code #RRGGBB";
    copyBtn.setAttribute("aria-label", "Copy all swatch names and hex codes from this palette");
    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = await copyTextToClipboard(textToCopy);
      showCopyToast(ok ? `Copied ${hexes.length} swatches (name + hex)` : "Copy failed — try again");
    });
    top.appendChild(nameLine);
    top.appendChild(copyBtn);
    head.appendChild(top);

    const sw = renderSwatchRow(p.colors || []);
    card.appendChild(head);
    card.appendChild(sw);
    container.appendChild(card);
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function main() {
  const chipsEl = document.getElementById("chips");
  const resultsEl = document.getElementById("results");
  const statusEl = document.getElementById("status");
  const errEl = document.getElementById("err");

  let selectedChipId = null;
  /** @type {{ list: unknown[]; mindful: unknown; pinterest: unknown; pinterestFetchOk?: boolean } | null} */
  let paletteBundle = null;
  let matchGeneration = 0;

  async function ensurePalettes() {
    if (paletteBundle) return paletteBundle;
    // Mindful + optional curated supplement + Pinterest in parallel.
    const [mRes, pRes, sRes] = await Promise.all([
      fetch("./data/mindful-palettes.json"),
      fetch("./data/pinterest-colors.json"),
      fetch("./data/palette-pool-supplement.json"),
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

  function redrawChips() {
    renderChips(chipsEl, selectedChipId, (next) => {
      selectedChipId = next;
      redrawChips();
      void runMatch();
    });
  }

  async function runMatch() {
    const gen = ++matchGeneration;
    errEl.hidden = true;
    const target = aggregateTarget(selectedChipId, "");
    if (!target) {
      resultsEl.innerHTML = '<p class="empty">Select a mood tag to see matching palettes.</p>';
      statusEl.className = "meta-bar";
      statusEl.textContent = paletteBundle
        ? "Pick a mood tag — results appear instantly."
        : "";
      return;
    }
    statusEl.className = "meta-bar status--loading";
    statusEl.textContent = paletteBundle
      ? pickLoadingLine(MATCH_LOADING_LINES, gen)
      : pickLoadingLine(LIBRARY_LOADING_LINES, gen);
    try {
      const bundle = await ensurePalettes();
      if (gen !== matchGeneration) return;
      const list = bundle.list || [];
      const identityStr = moodScoreIdentity(target);
      const fp = moodExtraFingerprint(list);
      const loadedScoreMap = loadMoodScoreCache(identityStr, fp);
      const useScoreCache = loadedScoreMap && scoreMapCoversList(list, loadedScoreMap);
      const scorePersist = {};

      const rows = [];
      let maxScore = 0;
      let skippedIntra = 0;
      const nList = list.length;
      let scored = 0;
      statusEl.textContent = `${pickLoadingLine(MATCH_LOADING_LINES, gen + nList)} · 0%`;
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
          scored++;
          if (scored % SCORE_YIELD_INTERVAL === 0) {
            if (gen !== matchGeneration) return;
            const pct = Math.min(100, Math.round(((i + 1) / nList) * 100));
            statusEl.textContent = `${pickLoadingLine(MATCH_LOADING_LINES, scored + i)} · ${pct}%`;
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
        const s = scoreMoodDirectional(pal, target.moodId, target.lemmas, summary);
        scorePersist[k] = s;
        maxScore = Math.max(maxScore, s);
        rows.push({ score: s, p, pal });
        scored++;
        if (scored % SCORE_YIELD_INTERVAL === 0) {
          if (gen !== matchGeneration) return;
          const pct = Math.min(100, Math.round(((i + 1) / nList) * 100));
          statusEl.textContent = `${pickLoadingLine(MATCH_LOADING_LINES, scored + i)} · ${pct}%`;
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (!useScoreCache && Object.keys(scorePersist).length) {
        saveMoodScoreCache(identityStr, fp, scorePersist);
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
        shown = prioritizeMindfulFirstByScore(shown, MAX_RESULTS_SHOWN);
        shown = shuffleRowsWithinMatchBands(shown, maxScore);
      }
      const pct = Math.round(MIN_SCORE_REL_TO_TOP * 100);
      if (gen !== matchGeneration) return;
      statusEl.className = "meta-bar";
      if (!bundle.pinterestFetchOk) {
        statusEl.textContent =
          "Tip: add pinterest-colors.json beside this page (serve over HTTP) for the full Pinterest set.";
      } else {
        statusEl.textContent = "";
      }
      if (!shown.length) {
        resultsEl.innerHTML = `<p class="empty">No palettes reached ${pct}% of the best match within their source. Try another mood.</p>`;
      } else {
        renderResults(resultsEl, shown, maxScore);
      }
    } catch (e) {
      if (gen !== matchGeneration) return;
      errEl.hidden = false;
      errEl.textContent = String(e.message || e);
      resultsEl.innerHTML = "";
      statusEl.className = "meta-bar";
      statusEl.textContent = "";
    }
  }

  if (typeof scoreMoodDirectional !== "function" || typeof window.buildPaletteMoodFeatures !== "function") {
    errEl.hidden = false;
    errEl.textContent = "Missing mood-engine-v2.js — ensure it is loaded before app.js in index.html.";
  }

  redrawChips();

  resultsEl.innerHTML = '<p class="empty">Select a mood tag to see matching palettes.</p>';
  statusEl.className = "meta-bar status--loading";
  statusEl.textContent = pickLoadingLine(LIBRARY_LOADING_LINES, 0);
  ensurePalettes()
    .then(() => {
      errEl.hidden = true;
      statusEl.className = "meta-bar";
      if (selectedChipId) void runMatch();
      else statusEl.textContent = "Pick a mood tag — results appear after you choose one.";
    })
    .catch((e) => {
      errEl.hidden = false;
      errEl.textContent = String(e.message || e);
      statusEl.className = "meta-bar";
      statusEl.textContent = "";
      resultsEl.innerHTML = "";
    });
}

main();
