/**
 * Mood → website theme tokens (primary / secondary / tertiary / supplementary + Material-style).
 * Uses OKLab distance for pool + palette dedupe; greedy role selection with WCAG on-colors.
 */
(function (global) {
  "use strict";

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  function linearSrgb(u) {
    return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  }

  function rgbToOklab(r, g, b) {
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

  function oklabToOklch(L, a, b) {
    const C = Math.sqrt(a * a + b * b);
    let h = (Math.atan2(b, a) * 180) / Math.PI;
    if (h < 0) h += 360;
    return [L, C, h];
  }

  function enrichColor(hex) {
    const H = global.MoodThemePalette.normalizeHex(hex);
    const [r, g, b] = global.MoodThemePalette.hexToRgb(H);
    const [L, a, b_] = rgbToOklab(r, g, b);
    const [l, c, h] = oklabToOklch(L, a, b_);
    const hsl = rgbToHsl(r, g, b);
    const hslH = ((hsl[0] % 360) + 360) % 360;
    const hslS = hsl[1];
    const hslL = hsl[2];
    const isNeutral = c < 0.035;
    const isDark = l < 0.28;
    const isLight = l > 0.78;
    const isVivid = c > 0.16;
    const isMuted = c < 0.08;
    const isPastel = l > 0.72 && c >= 0.05 && c <= 0.16;
    const isNeon = c > 0.26 && l > 0.55;
    const isDeep = l < 0.42 && c > 0.08;
    const temp = Math.cos((h * Math.PI) / 180) * (c / 0.22);
    const family = inferFamilyLabel(hslH, hslS, hslL, l, c, h);
    return { hex: H, h, l, c, temp, family, isNeutral, isDark, isLight, isVivid, isMuted, isPastel, isNeon, isDeep };
  }

  function rgbToHsl(r, g, b) {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const L = (mx + mn) / 2;
    const d = mx - mn;
    if (d < 1e-9) return [0, 0, L];
    const s = L > 0.5 ? d / (2 - mx - mn) : d / (mx - mn);
    let h0;
    if (mx === r) h0 = ((g - b) / d + (g < b ? 6 : 0)) % 6;
    else if (mx === g) h0 = (b - r) / d + 2;
    else h0 = (r - g) / d + 4;
    return [h0 * 60, s, L];
  }

  function inferFamilyLabel(hslH, hslS, hslL, okL, okC, okh) {
    const cn = clamp01(okC / 0.22);
    const h = ((okh % 360) + 360) % 360;
    if (cn < 0.07 || okC < 0.012) {
      if (okL > 0.94 && hslH > 55 && hslH < 115 && hslS < 0.12) return "cream";
      if (okL > 0.93 && hslS < 0.08) return "ivory";
      if (okL > 0.96) return "white";
      if (okL < 0.07) return "black";
      return "grey";
    }
    if (okL < 0.3 && h > 215 && h < 272) return "navy";
    if (h >= 95 && h < 152 && cn < 0.52) return "sage";
    if (h >= 165 && h < 210) return "cyan";
    if (h >= 38 && h < 58 && okL > 0.62 && cn < 0.55) return "gold";
    if (h >= 25 && h < 75 && hslL < 0.42 && cn < 0.45) return "brown";
    if (h >= 300 && h <= 345 && cn > 0.35) return "hotPink";
    if (h >= 100 && h < 145 && okL < 0.42) return "moss";
    if (h < 16 || h >= 352) return "red";
    if (h < 44) return "orange";
    if (h < 98) return "yellow";
    if (h < 152) return "green";
    if (h < 198) return "teal";
    if (h < 258) return "blue";
    if (h < 302) return "purple";
    if (h < 340) return "pink";
    return "red";
  }

  function colorDistanceOKLab(e1, e2) {
    const [L1, a1, b1] = rgbToOklab(...global.MoodThemePalette.hexToRgb(e1.hex));
    const [L2, a2, b2] = rgbToOklab(...global.MoodThemePalette.hexToRgb(e2.hex));
    const dL = L1 - L2;
    const da = a1 - a2;
    const db = b1 - b2;
    return Math.sqrt(dL * dL + da * da + db * db);
  }

  function paletteDistanceOKLab(paletteA, paletteB) {
    const ca = (paletteA.colors || []).map((c) => enrichColor(c.hex)).filter((c) => c.hex);
    const cb = (paletteB.colors || []).map((c) => enrichColor(c.hex)).filter((c) => c.hex);
    if (!ca.length || !cb.length) return 1;
    function meanNearest(from, to) {
      let tot = 0;
      for (const a of from) {
        let nearest = Infinity;
        for (const b of to) nearest = Math.min(nearest, colorDistanceOKLab(a, b));
        tot += nearest;
      }
      return tot / from.length;
    }
    return (meanNearest(ca, cb) + meanNearest(cb, ca)) / 2;
  }

  function dedupePalettesPerceptual(scoredRows, minDistance) {
    const kept = [];
    for (const row of scoredRows) {
      let too = false;
      for (const k of kept) {
        if (paletteDistanceOKLab(row.p, k.p) < minDistance) {
          too = true;
          break;
        }
      }
      if (!too) kept.push(row);
    }
    return kept;
  }

  function dedupeSimilarColors(enrichedList) {
    const sorted = [...enrichedList].sort((a, b) => {
      const pa = (a.paletteScore || 0) + a.c * 0.35 + usableColorScore(a) * 0.25;
      const pb = (b.paletteScore || 0) + b.c * 0.35 + usableColorScore(b) * 0.25;
      return pb - pa;
    });
    const kept = [];
    for (const c of sorted) {
      const sim = kept.some((k) => colorDistanceOKLab(c, k) < 0.045);
      if (!sim) kept.push(c);
    }
    return kept;
  }

  function usableColorScore(c) {
    if (c.isNeutral) return c.l > 0.12 && c.l < 0.93 ? 1 : 0.55;
    return c.l > 0.18 && c.l < 0.88 ? 1 : 0.65;
  }

  function distinctiveColorScore(c) {
    return clamp01(0.45 + 0.55 * Math.min(1, c.c / 0.22));
  }

  function bandScore(value, min, max, softness) {
    if (value >= min && value <= max) return 1;
    if (value < min) return Math.exp(-Math.pow((min - value) / softness, 2));
    return Math.exp(-Math.pow((value - max) / softness, 2));
  }

  function rangePeak(value, min, max, peak) {
    if (value < min || value > max) return 0;
    if (value === peak) return 1;
    if (value < peak) return clamp01((value - min) / (peak - min + 1e-9));
    return clamp01((max - value) / (max - peak + 1e-9));
  }

  function hueDistanceDeg(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  }

  function singleColorMoodFit(color, moodId) {
    const vivid = ["energy", "urgent", "festival", "joy", "play"];
    const soft = ["calm", "wedding", "dawn", "romance", "ocean", "forest"];
    const dark = ["lux", "noir", "midnight", "forest"];
    let hueS = 0.5;
    let lS = bandScore(color.l, 0.28, 0.78, 0.2);
    let cS = bandScore(color.c, 0.06, 0.28, 0.12);
    if (vivid.includes(moodId)) {
      cS = bandScore(color.c, 0.14, 0.32, 0.1);
      lS = bandScore(color.l, 0.38, 0.82, 0.18);
    } else if (soft.includes(moodId)) {
      cS = bandScore(color.c, 0.04, 0.2, 0.08);
      lS = bandScore(color.l, 0.55, 0.92, 0.14);
    } else if (dark.includes(moodId)) {
      lS = bandScore(color.l, 0.08, 0.52, 0.18);
      cS = bandScore(color.c, 0.05, 0.24, 0.1);
    }
    if (moodId === "pure") hueS = color.isNeutral ? 0.95 : 0.25;
    if (moodId === "clinical" || moodId === "trust" || moodId === "tech") hueS = color.temp < 0 ? 0.62 : 0.45;
    return clamp01(0.34 * hueS + 0.33 * lS + 0.33 * cS);
  }

  function primaryChromaFit(color, moodId) {
    const vivid = ["energy", "urgent", "festival", "joy", "play", "tech"];
    const soft = ["calm", "wedding", "dawn", "romance"];
    const dark = ["lux", "noir", "midnight"];
    if (vivid.includes(moodId)) return bandScore(color.c, 0.14, 0.32, 0.08);
    if (soft.includes(moodId)) return bandScore(color.c, 0.05, 0.18, 0.08);
    if (dark.includes(moodId)) return bandScore(color.c, 0.06, 0.24, 0.1);
    return bandScore(color.c, 0.08, 0.26, 0.09);
  }

  function primaryLightnessFit(color, moodId) {
    const dark = ["lux", "noir", "midnight", "forest"];
    const bright = ["joy", "dawn", "wedding", "crisp"];
    const urgent = ["urgent", "energy", "festival"];
    if (dark.includes(moodId)) return bandScore(color.l, 0.14, 0.48, 0.16);
    if (bright.includes(moodId)) return bandScore(color.l, 0.52, 0.88, 0.16);
    if (urgent.includes(moodId)) return bandScore(color.l, 0.4, 0.78, 0.16);
    return bandScore(color.l, 0.32, 0.72, 0.18);
  }

  function primaryMoodExceptionScore(color, moodId) {
    if (moodId === "pure") return color.isNeutral ? 1 : 0.22;
    const f = color.family;
    if (moodId === "lux") {
      if (["black", "gold", "green", "purple", "red"].includes(f)) return 0.95;
    }
    if (moodId === "clinical" || moodId === "trust") {
      if (["blue", "cyan", "teal", "navy", "grey"].includes(f)) return 0.95;
    }
    if (moodId === "urgent") {
      if (["red", "orange", "yellow", "hotPink"].includes(f)) return 1;
    }
    return 0.5;
  }

  function primaryColorScore(color, moodId) {
    const moodFit = singleColorMoodFit(color, moodId);
    const chromaFit = primaryChromaFit(color, moodId);
    const lightnessFit = primaryLightnessFit(color, moodId);
    const distinct = distinctiveColorScore(color);
    const usability = usableColorScore(color);
    const ex = primaryMoodExceptionScore(color, moodId);
    return clamp01(
      moodFit * 0.4 + chromaFit * 0.18 + lightnessFit * 0.14 + distinct * 0.14 + usability * 0.1 + ex * 0.04,
    );
  }

  function calmAnalogous(moodId) {
    return ["calm", "ocean", "forest", "earth", "cozy", "wedding", "romance", "dawn", "clinical", "crisp", "trust"].includes(moodId);
  }
  function highContrastMoods(moodId) {
    return ["energy", "urgent", "festival", "play", "joy", "tech"].includes(moodId);
  }
  function premiumMoods(moodId) {
    return ["lux", "noir", "midnight", "melancholy"].includes(moodId);
  }

  function secondaryHueRelationScore(color, primary, moodId) {
    if (color.isNeutral) return calmAnalogous(moodId) || premiumMoods(moodId) ? 0.78 : 0.45;
    const d = hueDistanceDeg(color.h, primary.h);
    if (calmAnalogous(moodId)) return rangePeak(d, 15, 65, 35);
    if (highContrastMoods(moodId)) return Math.max(rangePeak(d, 120, 180, 150), rangePeak(d, 80, 140, 110));
    if (premiumMoods(moodId)) return Math.max(rangePeak(d, 20, 75, 42), rangePeak(d, 130, 180, 155));
    return rangePeak(d, 35, 150, 85);
  }

  function roleDistinctnessScore(color, primary) {
    return clamp01(colorDistanceOKLab(color, primary) / 0.14);
  }

  function secondaryColorScore(color, primary, moodId) {
    const relation = secondaryHueRelationScore(color, primary, moodId);
    const moodFit = singleColorMoodFit(color, moodId);
    const distinct = roleDistinctnessScore(color, primary);
    const usability = usableColorScore(color);
    const notTooDominant = color.c <= primary.c + 0.08 ? 1 : 0.75;
    return clamp01(relation * 0.32 + moodFit * 0.24 + distinct * 0.18 + usability * 0.16 + notTooDominant * 0.1);
  }

  function isValidTertiary(color, primary, secondary, moodId) {
    if (color.hex === primary.hex || color.hex === secondary.hex) return false;
    if (!color.isNeutral) {
      const dP = hueDistanceDeg(color.h, primary.h);
      const dS = hueDistanceDeg(color.h, secondary.h);
      if (dP < 55) return false;
      if (dS < 35) return false;
    }
    if (moodId !== "pure" && color.isNeutral) return false;
    return true;
  }

  function tertiaryColorScore(color, primary, secondary, moodId) {
    if (!isValidTertiary(color, primary, secondary, moodId)) return 0;
    const dPrimary = color.isNeutral ? 90 : hueDistanceDeg(color.h, primary.h);
    const dSecondary = color.isNeutral ? 70 : hueDistanceDeg(color.h, secondary.h);
    const hueDiff = clamp01(dPrimary / 120);
    const secDiff = clamp01(dSecondary / 90);
    const moodFit = singleColorMoodFit(color, moodId);
    const usability = usableColorScore(color);
    return clamp01(hueDiff * 0.28 + secDiff * 0.16 + moodFit * 0.34 + usability * 0.14 + distinctiveColorScore(color) * 0.08);
  }

  function supplementaryNeutralFit(color) {
    if (color.isNeutral) return 1;
    const soft = ["cream", "ivory", "grey", "sage", "blue", "teal", "green"];
    if (soft.includes(color.family) && color.c < 0.1) return 0.85;
    return 0.25;
  }

  function supplementaryMoodFit(color, moodId) {
    const warm = ["cozy", "earth", "artisan", "romance", "wedding", "dawn", "nostalgia", "lux"];
    const cool = ["calm", "trust", "clinical", "tech", "crisp", "ocean", "midnight"];
    const dark = ["noir", "midnight", "lux", "tech"];
    const f = color.family;
    if (warm.includes(moodId) && ["cream", "ivory", "brown", "gold", "grey"].includes(f)) return 1;
    if (cool.includes(moodId) && ["white", "grey", "navy", "blue", "cyan"].includes(f)) return 1;
    if (dark.includes(moodId) && ["black", "navy", "grey", "ivory"].includes(f)) return 1;
    if (moodId === "pure") return color.isNeutral ? 1 : 0.1;
    return color.isNeutral ? 0.85 : 0.45;
  }

  function layerUsefulnessScore(c) {
    return c.isLight || c.isDark || c.isNeutral ? 0.85 : 0.55;
  }

  function relativeLuminance(hex) {
    const tf = (s) => (s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4));
    const [rs, gs, bs] = global.MoodThemePalette.hexToRgb(global.MoodThemePalette.normalizeHex(hex));
    const R = tf(rs);
    const G = tf(gs);
    const B = tf(bs);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  function contrastRatio(hexA, hexB) {
    const L1 = relativeLuminance(hexA);
    const L2 = relativeLuminance(hexB);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  const MOODS_ALLOW_PURE_BW = ["urgent", "noir", "pure", "festival"];

  function moodAllowsPureBlackWhite(moodId) {
    return MOODS_ALLOW_PURE_BW.includes(moodId);
  }

  const TONE_MODES = {
    soft: { chromaMultiplier: 0.72, contrastMultiplier: 0.86, surfaceTint: 0.08, textContrastTarget: 4.5, decorationOpacity: 0.18 },
    clear: { chromaMultiplier: 1, contrastMultiplier: 1, surfaceTint: 0.05, textContrastTarget: 4.5, decorationOpacity: 0.22 },
    vivid: { chromaMultiplier: 1.18, contrastMultiplier: 1.06, surfaceTint: 0.06, textContrastTarget: 4.5, decorationOpacity: 0.28 },
    muted: { chromaMultiplier: 0.58, contrastMultiplier: 0.9, surfaceTint: 0.1, textContrastTarget: 4.5, decorationOpacity: 0.16 },
    neon: {
      chromaMultiplier: 1.35,
      contrastMultiplier: 1.12,
      preferDarkBase: true,
      textContrastTarget: 4.5,
      decorationOpacity: 0.32,
    },
    luxury: {
      chromaMultiplier: 0.88,
      contrastMultiplier: 0.96,
      preferDeepBase: true,
      textContrastTarget: 4.5,
      decorationOpacity: 0.14,
    },
    minimal: { chromaMultiplier: 0.42, contrastMultiplier: 0.94, maxAccentCount: 1, textContrastTarget: 4.5, decorationOpacity: 0.1 },
  };

  const MOOD_CONTRAST_PROFILE = {
    calm: { ui: "lowMedium", text: 4.5, decorative: 1.25 },
    trust: { ui: "medium", text: 4.5, decorative: 1.4 },
    energy: { ui: "mediumHigh", text: 4.5, decorative: 1.75 },
    play: { ui: "medium", text: 4.5, decorative: 1.55 },
    lux: { ui: "controlled", text: 4.5, decorative: 1.35 },
    earth: { ui: "lowMedium", text: 4.5, decorative: 1.25 },
    melancholy: { ui: "lowDark", text: 4.5, decorative: 1.18 },
    joy: { ui: "mediumBright", text: 4.5, decorative: 1.55 },
    romance: { ui: "soft", text: 4.5, decorative: 1.22 },
    clinical: { ui: "clear", text: 4.5, decorative: 1.45 },
    tech: { ui: "sharp", text: 4.5, decorative: 1.7 },
    cozy: { ui: "softWarm", text: 4.5, decorative: 1.22 },
    crisp: { ui: "clearCool", text: 4.5, decorative: 1.35 },
    noir: { ui: "dramatic", text: 4.5, decorative: 1.85 },
    nostalgia: { ui: "muted", text: 4.5, decorative: 1.2 },
    pure: { ui: "functional", text: 4.5, decorative: 1.15 },
    urgent: { ui: "high", text: 4.5, decorative: 2.0 },
    ocean: { ui: "mediumSoft", text: 4.5, decorative: 1.3 },
    forest: { ui: "deepNatural", text: 4.5, decorative: 1.28 },
    midnight: { ui: "darkControlled", text: 4.5, decorative: 1.45 },
    dawn: { ui: "softBright", text: 4.5, decorative: 1.18 },
    festival: { ui: "maximalHigh", text: 4.5, decorative: 2.0 },
    wedding: { ui: "softElegant", text: 4.5, decorative: 1.18 },
    artisan: { ui: "mutedCraft", text: 4.5, decorative: 1.22 },
    default: { ui: "medium", text: 4.5, decorative: 1.35 },
  };

  const WEBSITE_COLOR_RULES = {
    philosophy: [
      "Primary expresses brand action.",
      "Secondary supports structure and interaction.",
      "Tertiary adds expressive contrast.",
      "Supplementary protects readability and layout.",
      "Light and dark modes preserve contrast intent, not naive inversion.",
      "Large surfaces use lower chroma than buttons or accents.",
      "Decorative elements stay mood-rich but hierarchy-soft.",
      "Text must pass contrast requirements.",
    ],
    accessibility: { normalText: 4.5, largeText: 3, icons: 3, focusRing: 3, decorativeMinimum: 1.15 },
    contrastStyle: {
      avoidPureBlackWhiteByDefault: true,
      useSoftBlack: true,
      useSoftWhite: true,
      allowPureContrastFor: MOODS_ALLOW_PURE_BW,
    },
  };

  function mixHexRgb(hexA, hexB, t) {
    const a = global.MoodThemePalette.normalizeHex(hexA);
    const b = global.MoodThemePalette.normalizeHex(hexB);
    const [ra, ga, ba] = global.MoodThemePalette.hexToRgb(a);
    const [rb, gb, bb] = global.MoodThemePalette.hexToRgb(b);
    const u = clamp01(t);
    return rgb01ToHex(ra + (rb - ra) * u, ga + (gb - ga) * u, ba + (bb - ba) * u);
  }

  function nudgeHueToward(hDeg, targetDeg, amount) {
    const h = ((hDeg % 360) + 360) % 360;
    const t = ((targetDeg % 360) + 360) % 360;
    let d = t - h;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return ((h + d * clamp01(amount)) % 360 + 360) % 360;
  }

  function hslLightnessNudge(hex, delta) {
    const [r, g, b] = global.MoodThemePalette.hexToRgb(global.MoodThemePalette.normalizeHex(hex));
    const hsl = rgbToHsl(r, g, b);
    hsl[2] = clamp01(hsl[2] + delta);
    const [nr, ng, nb] = hslToRgb(((hsl[0] % 360) + 360) % 360, hsl[1], hsl[2]);
    return rgb01ToHex(nr, ng, nb);
  }

  function ensureContrastAgainstBg(bgHex, fgHex, minRatio, mode) {
    let cand = global.MoodThemePalette.normalizeHex(fgHex);
    const bg = global.MoodThemePalette.normalizeHex(bgHex);
    for (let i = 0; i < 18; i++) {
      if (contrastRatio(bg, cand) >= minRatio) return cand;
      cand = mode === "light" ? hslLightnessNudge(cand, -0.045) : hslLightnessNudge(cand, 0.055);
    }
    const w = contrastRatio(bg, "#FFFFFF");
    const k = contrastRatio(bg, "#000000");
    return w >= k ? "#FFFFFF" : "#171717";
  }

  function chooseOnColor(bgHex, candidateHexes) {
    const defaults = ["#FFFFFF", "#000000", "#111111", "#F8F5EF", "#1C1C1C"];
    const pool = [...new Set([...candidateHexes.map((h) => global.MoodThemePalette.normalizeHex(h)).filter(Boolean), ...defaults])];
    let best = "#000000";
    let bestC = 0;
    for (const hx of pool) {
      const r = contrastRatio(bgHex, hx);
      if (r > bestC) {
        bestC = r;
        best = hx;
      }
    }
    return { hex: best, contrast: bestC, passesNormalText: bestC >= 4.5, passesLargeText: bestC >= 3 };
  }

  function readableOrFallback(bgHex, candidateHexes, moodId) {
    const soft = ["#171717", "#1C1C1C", "#252B2E", "#F7F4EE", "#F4F6F8", "#EEF1F3", "#EDEAE4"];
    const allowPure = moodId && moodAllowsPureBlackWhite(moodId);
    const pool = allowPure
      ? [...candidateHexes]
      : [...soft, ...candidateHexes, "#111111", "#FAFAFA"];
    const ch = chooseOnColor(bgHex, pool);
    if (ch.contrast >= 4.5) return ch.hex;
    const w = contrastRatio(bgHex, "#FAFAFA");
    const k = contrastRatio(bgHex, "#171717");
    if (allowPure) return w >= k ? "#FFFFFF" : "#000000";
    return w >= k ? "#FAFAFA" : "#171717";
  }

  function supplementaryColorScore(color, primary, secondary, tertiary, moodId) {
    const c1 = contrastRatio(color.hex, primary.hex);
    const c2 = contrastRatio(color.hex, secondary.hex);
    const r1 = c1 >= 4.5 ? 1 : c1 / 4.5;
    const r2 = c2 >= 3 ? 1 : c2 / 3;
    const neutralFit = supplementaryNeutralFit(color);
    const moodFit = supplementaryMoodFit(color, moodId);
    const layer = layerUsefulnessScore(color);
    return clamp01(r1 * 0.28 + r2 * 0.14 + neutralFit * 0.26 + moodFit * 0.18 + layer * 0.14);
  }

  function selectBest(items, scoreFn) {
    let best = null;
    let bestS = -Infinity;
    for (const it of items) {
      const s = scoreFn(it);
      if (s > bestS) {
        bestS = s;
        best = it;
      }
    }
    return best;
  }

  function rowIsPinterest(row) {
    return row.p && row.p.source === "pinterest";
  }

  /** Reserve roughly half the pool for Mindful vs Pinterest so theme swatches are not dominated by one source. */
  function stratifyScoredRowsForPool(rows, limit) {
    const pin = rows.filter((r) => rowIsPinterest(r)).sort((a, b) => b.score - a.score);
    const mind = rows.filter((r) => !rowIsPinterest(r)).sort((a, b) => b.score - a.score);
    const half = Math.ceil(limit / 2);
    const mindTake = Math.min(half, mind.length);
    const pinTake = Math.min(limit - mindTake, pin.length);
    const picked = [...mind.slice(0, mindTake), ...pin.slice(0, pinTake)];
    if (picked.length < limit) {
      const restM = mind.slice(mindTake);
      const restP = pin.slice(pinTake);
      let mi = 0;
      let pi = 0;
      while (picked.length < limit && (mi < restM.length || pi < restP.length)) {
        if (picked.length < limit && mi < restM.length) picked.push(restM[mi++]);
        if (picked.length < limit && pi < restP.length) picked.push(restP[pi++]);
      }
    }
    picked.sort((a, b) => b.score - a.score);
    return picked.slice(0, limit);
  }

  function buildCandidatePool(scoredRows) {
    const pool = [];
    for (const row of scoredRows) {
      const sc = row.score;
      const src = rowIsPinterest(row) ? "pinterest" : "mindful";
      for (const col of row.p.colors || []) {
        const hx = global.MoodThemePalette.normalizeHex(col.hex);
        if (!hx) continue;
        pool.push({ ...enrichColor(hx), paletteScore: sc, paletteSource: src });
      }
    }
    return dedupeSimilarColors(pool);
  }

  function chooseBackgroundColor(supplementary, moodId, candidates) {
    const dark = ["noir", "midnight", "lux", "tech"];
    const light = ["calm", "clinical", "crisp", "wedding", "dawn", "joy", "pure", "cozy"];
    const neutrals = candidates.filter((c) => c.isNeutral || c.c < 0.08);
    if (dark.includes(moodId)) {
      const d = selectBest(neutrals, (c) => bandScore(c.l, 0.05, 0.22, 0.12) + (c.isNeutral ? 0.25 : 0));
      if (d) return d;
    }
    if (light.includes(moodId)) {
      const d = selectBest(neutrals, (c) => bandScore(c.l, 0.86, 0.98, 0.1) + (c.isNeutral ? 0.25 : 0));
      if (d) return d;
    }
    if (supplementary.l > 0.82 || supplementary.l < 0.22) return supplementary;
    return supplementary.l > 0.5
      ? enrichColor("#FFFFFF")
      : enrichColor("#111111");
  }

  function hslToRgb(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return [f(0), f(8), f(4)];
  }

  function rgb01ToHex(r, g, b) {
    const R = Math.round(clamp01(r) * 255);
    const G = Math.round(clamp01(g) * 255);
    const B = Math.round(clamp01(b) * 255);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

  function chooseSurfaceColor(background, candidates) {
    const subs = candidates.filter((c) => {
      const r = contrastRatio(background.hex, c.hex);
      return r >= 1.05 && r <= 2.25 && (c.isNeutral || c.c < 0.08);
    });
    const surf = selectBest(subs, (c) => {
      const ld = Math.abs(c.l - background.l);
      return (1 - Math.min(1, ld / 0.22)) * 0.7 + (c.isNeutral ? 0.3 : 0);
    });
    if (surf) return surf;
    const L = background.l > 0.55 ? Math.max(0.02, background.l - 0.04) : Math.min(0.98, background.l + 0.04);
    return enrichColor(adjustLightnessHex(background.hex, L));
  }

  function adjustLightnessHex(hex, targetHslL01) {
    const [r, g, b] = global.MoodThemePalette.hexToRgb(global.MoodThemePalette.normalizeHex(hex));
    const hsl = rgbToHsl(r, g, b);
    hsl[2] = clamp01(targetHslL01);
    const [nr, ng, nb] = hslToRgb(((hsl[0] % 360) + 360) % 360, hsl[1], hsl[2]);
    return rgb01ToHex(nr, ng, nb);
  }

  function makeVariant(hex, moodId, role) {
    const e = enrichColor(hex);
    const darkM = ["lux", "noir", "midnight", "forest", "trust", "tech"];
    const lightM = ["calm", "wedding", "dawn", "clinical", "crisp"];
    let dL = e.l > 0.55 ? -0.08 : 0.08;
    if (darkM.includes(moodId)) dL = -0.1;
    if (lightM.includes(moodId)) dL = 0.08;
    const [r, g, b] = global.MoodThemePalette.hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    const nl = clamp01(hsl[2] + dL);
    const [nr, ng, nb] = hslToRgb(((hsl[0] % 360) + 360) % 360, hsl[1], nl);
    return rgb01ToHex(nr, ng, nb);
  }

  function applyToneChromaHex(hex, mult) {
    const H = global.MoodThemePalette.normalizeHex(hex);
    const [r, g, b] = global.MoodThemePalette.hexToRgb(H);
    const hsl = rgbToHsl(r, g, b);
    hsl[1] = clamp01(hsl[1] * mult);
    const [nr, ng, nb] = hslToRgb(((hsl[0] % 360) + 360) % 360, hsl[1], hsl[2]);
    return rgb01ToHex(nr, ng, nb);
  }

  function softenOffWhitePageBackground(bgHex, tintHex, moodId) {
    if (moodAllowsPureBlackWhite(moodId)) return global.MoodThemePalette.normalizeHex(bgHex);
    const u = String(bgHex).toUpperCase();
    if (u === "#FFFFFF" || u === "#FFF") return mixHexRgb(bgHex, tintHex, 0.07);
    const e = enrichColor(bgHex);
    if (e.l > 0.97 && e.c < 0.02) return mixHexRgb(bgHex, tintHex, 0.05);
    return global.MoodThemePalette.normalizeHex(bgHex);
  }

  function hexToRgba(hex, a) {
    const [r, g, b] = global.MoodThemePalette.hexToRgb(global.MoodThemePalette.normalizeHex(hex));
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${clamp01(a)})`;
  }

  function chooseTagSourceHex(material, moodId) {
    const tertiaryTagMoods = ["play", "joy", "festival", "wedding", "romance", "dawn", "artisan", "ocean"];
    const secondaryTagMoods = ["calm", "trust", "clinical", "cozy", "earth", "forest", "nostalgia"];
    if (tertiaryTagMoods.includes(moodId)) return material.tertiary;
    if (secondaryTagMoods.includes(moodId)) return material.secondary;
    return material.primary;
  }

  function buildWebsiteFrontendTokens(material, moodId, mode, tone, candHexes) {
    const toneProfile = TONE_MODES[tone] || TONE_MODES.clear;
    const cp = MOOD_CONTRAST_PROFILE[moodId] || MOOD_CONTRAST_PROFILE.default;
    const cMult = toneProfile.chromaMultiplier;
    const p = applyToneChromaHex(material.primary, cMult);
    const s = applyToneChromaHex(material.secondary, cMult * 0.96);
    const t = applyToneChromaHex(material.tertiary, cMult * 0.94);
    const q = applyToneChromaHex(material.supplementary, Math.min(1, cMult * 0.52));

    let bg = global.MoodThemePalette.normalizeHex(material.background);
    if (mode === "light") {
      bg = softenOffWhitePageBackground(bg, p, moodId);
    } else {
      const eb = enrichColor(bg);
      if (eb.l > 0.45) bg = mixHexRgb(bg, mixHexRgb(p, "#0a0c10", 0.88), 0.58);
      if (toneProfile.preferDarkBase) bg = mixHexRgb(bg, "#050608", 0.28);
      if (toneProfile.preferDeepBase) bg = mixHexRgb(bg, "#080a0c", 0.22);
    }

    const backgroundAlt =
      mode === "light" ? mixHexRgb(bg, s, toneProfile.surfaceTint) : mixHexRgb(bg, s, toneProfile.surfaceTint * 0.72);
    const surface = mode === "light" ? hslLightnessNudge(bg, -0.02) : hslLightnessNudge(bg, 0.042);
    const surfaceElevated = mixHexRgb(surface, p, mode === "light" ? 0.03 : 0.06);
    const surfaceMuted = mode === "light" ? mixHexRgb(bg, s, 0.055) : mixHexRgb(bg, s, 0.08);

    const textMode = mode === "light" ? "light" : "dark";
    const textPriSeed = mode === "light" ? mixHexRgb("#1a1f24", p, 0.12) : mixHexRgb("#E8EEF0", p, 0.1);
    const textPrimary = ensureContrastAgainstBg(bg, textPriSeed, cp.text, textMode);
    const textSecondary = ensureContrastAgainstBg(
      bg,
      mode === "light" ? mixHexRgb(textPrimary, bg, 0.25) : mixHexRgb(textPrimary, bg, 0.2),
      cp.text,
      textMode,
    );
    const textMuted = ensureContrastAgainstBg(
      bg,
      mode === "light" ? mixHexRgb(textPrimary, bg, 0.45) : mixHexRgb(textPrimary, bg, 0.38),
      3,
      textMode,
    );
    const textInverse = mode === "light" ? "#F7F4EE" : "#141618";

    const borderSubtle = mixHexRgb(mode === "light" ? "#1c2126" : "#eef2f4", bg, mode === "light" ? 0.9 : 0.92);
    const borderDefault = mixHexRgb(mode === "light" ? "#2a3238" : "#d8dee2", bg, mode === "light" ? 0.75 : 0.82);
    const divider = mixHexRgb(borderSubtle, bg, 0.42);

    const link = ensureContrastAgainstBg(bg, p, 4.5, textMode);
    const linkHover = hslLightnessNudge(link, mode === "light" ? -0.07 : 0.08);

    const buttonPrimaryBg = p;
    const buttonPrimaryText = readableOrFallback(buttonPrimaryBg, candHexes, moodId);
    const buttonPrimaryHover = hslLightnessNudge(buttonPrimaryBg, mode === "light" ? -0.06 : 0.07);
    const buttonPrimaryPressed = hslLightnessNudge(buttonPrimaryBg, mode === "light" ? -0.1 : 0.04);

    const buttonSecondaryBg = mode === "light" ? mixHexRgb(s, bg, 0.78) : mixHexRgb(s, bg, 0.55);
    const buttonSecondaryText = ensureContrastAgainstBg(buttonSecondaryBg, s, 4.5, textMode);
    const buttonSecondaryBorder = mixHexRgb(s, bg, mode === "light" ? 0.55 : 0.38);
    const buttonSecondaryHover = hslLightnessNudge(buttonSecondaryBg, mode === "light" ? -0.04 : 0.05);

    const buttonGhostText = ensureContrastAgainstBg(bg, p, 4.5, textMode);
    const buttonGhostHoverBg = mixHexRgb(p, bg, mode === "light" ? 0.88 : 0.72);

    const focusRing = mixHexRgb(p, mode === "light" ? "#ffffff" : "#0c0e12", 0.38);

    const tagSrc = chooseTagSourceHex({ primary: p, secondary: s, tertiary: t, supplementary: q }, moodId);
    const tagBg = mode === "light" ? mixHexRgb(tagSrc, bg, 0.86) : mixHexRgb(tagSrc, bg, 0.72);
    const tagText = ensureContrastAgainstBg(tagBg, tagSrc, 4.5, textMode);
    const tagBorder = mode === "light" ? mixHexRgb(tagSrc, bg, 0.62) : mixHexRgb(tagSrc, bg, 0.48);

    const op = toneProfile.decorationOpacity;
    const decorativeSoft = hexToRgba(s, op);
    const decorativeStrong = hexToRgba(t, Math.min(op + 0.12, 0.42));
    const glow =
      ["energy", "festival", "tech", "urgent", "joy", "play"].includes(moodId) && mode === "dark"
        ? hexToRgba(p, 0.28)
        : "transparent";
    const gradientA = mixHexRgb(p, bg, mode === "light" ? 0.72 : 0.52);
    const gradientB = mixHexRgb(t, bg, mode === "light" ? 0.82 : 0.62);

    const semantic = {
      background: bg,
      backgroundAlt,
      surface,
      surfaceElevated,
      surfaceMuted,
      overlay: mode === "light" ? "rgba(20, 22, 24, 0.42)" : "rgba(0, 0, 0, 0.58)",
      shadowColor: mode === "light" ? "rgba(24, 28, 32, 0.1)" : "rgba(0, 0, 0, 0.36)",
      textPrimary,
      textSecondary,
      textMuted,
      textInverse,
      borderSubtle,
      borderDefault,
      divider,
      link,
      linkHover,
      buttonPrimaryBg,
      buttonPrimaryText,
      buttonPrimaryHover,
      buttonPrimaryPressed,
      buttonSecondaryBg,
      buttonSecondaryText,
      buttonSecondaryBorder,
      buttonSecondaryHover,
      buttonGhostText,
      buttonGhostHoverBg,
      focusRing,
      tertiaryActionBg: tagBg,
      tertiaryActionText: tagText,
      tagBg,
      tagText,
      tagBorder,
      decorativeSoft,
      decorativeStrong,
      glow,
      gradientA,
      gradientB,
    };

    const statesLight = {
      success: "#2E7D32",
      warning: "#B26A00",
      error: "#B3261E",
      info: "#1769AA",
    };
    const statesDark = {
      success: "#81C784",
      warning: "#FFB74D",
      error: "#F2A6A0",
      info: "#8EC5FF",
    };
    const st = mode === "light" ? statesLight : statesDark;
    const successBg = mixHexRgb(st.success, bg, mode === "light" ? 0.9 : 0.78);
    const warningBg = mixHexRgb(st.warning, bg, mode === "light" ? 0.9 : 0.78);
    const errorBg = mixHexRgb(st.error, bg, mode === "light" ? 0.9 : 0.78);
    const infoBg = mixHexRgb(st.info, bg, mode === "light" ? 0.9 : 0.78);

    const states = {
      success: st.success,
      onSuccess: readableOrFallback(st.success, candHexes, moodId),
      warning: st.warning,
      onWarning: readableOrFallback(st.warning, candHexes, moodId),
      error: st.error,
      onError: readableOrFallback(st.error, candHexes, moodId),
      info: st.info,
      onInfo: readableOrFallback(st.info, candHexes, moodId),
      successBg,
      warningBg,
      errorBg,
      infoBg,
    };

    const components = {
      card: {
        bg: surface,
        bgElevated: surfaceElevated,
        border: borderSubtle,
        title: textPrimary,
        body: textSecondary,
        accent: p,
      },
      navbar: {
        bg: hexToRgba(surface, mode === "light" ? 0.92 : 0.88),
        text: textSecondary,
        activeText: p,
        activeIndicator: p,
        border: borderSubtle,
      },
      hero: {
        bg,
        headline: textPrimary,
        body: textSecondary,
        accent: p,
        decorativeA: decorativeSoft,
        decorativeB: decorativeStrong,
      },
      tag: { tagBg: semantic.tagBg, tagText: semantic.tagText, tagBorder: semantic.tagBorder },
      form: {
        inputBg: surface,
        inputText: textPrimary,
        placeholder: textMuted,
        border: borderDefault,
        borderFocus: p,
        helperText: textMuted,
      },
      footer: {
        bg: mode === "light" ? mixHexRgb(bg, "#0f1214", 0.92) : mixHexRgb(bg, "#000000", 0.25),
        text: textInverse,
        link: s,
        accent: t,
      },
      decorative: { decorativeSoft, decorativeStrong, glow, gradientA, gradientB },
    };

    const cssVariables = {
      "--color-primary": p,
      "--color-secondary": s,
      "--color-tertiary": t,
      "--color-supplementary": q,
      "--color-bg": semantic.background,
      "--color-bg-alt": semantic.backgroundAlt,
      "--color-surface": semantic.surface,
      "--color-surface-elevated": semantic.surfaceElevated,
      "--color-surface-muted": semantic.surfaceMuted,
      "--color-overlay": semantic.overlay,
      "--color-shadow": semantic.shadowColor,
      "--color-text-primary": semantic.textPrimary,
      "--color-text-secondary": semantic.textSecondary,
      "--color-text-muted": semantic.textMuted,
      "--color-text-inverse": semantic.textInverse,
      "--color-border-subtle": semantic.borderSubtle,
      "--color-border-default": semantic.borderDefault,
      "--color-divider": semantic.divider,
      "--color-link": semantic.link,
      "--color-link-hover": semantic.linkHover,
      "--color-link-visited": mixHexRgb(t, semantic.link, 0.35),
      "--color-button-primary-bg": semantic.buttonPrimaryBg,
      "--color-button-primary-text": semantic.buttonPrimaryText,
      "--color-button-primary-hover": semantic.buttonPrimaryHover,
      "--color-button-primary-pressed": semantic.buttonPrimaryPressed,
      "--color-button-secondary-bg": semantic.buttonSecondaryBg,
      "--color-button-secondary-text": semantic.buttonSecondaryText,
      "--color-button-secondary-border": semantic.buttonSecondaryBorder,
      "--color-button-secondary-hover": semantic.buttonSecondaryHover,
      "--color-button-ghost-text": semantic.buttonGhostText,
      "--color-button-ghost-hover-bg": semantic.buttonGhostHoverBg,
      "--color-focus-ring": semantic.focusRing,
      "--color-card-bg": components.card.bg,
      "--color-card-border": components.card.border,
      "--color-tag-bg": semantic.tagBg,
      "--color-tag-text": semantic.tagText,
      "--color-tag-border": semantic.tagBorder,
      "--color-decorative-soft": semantic.decorativeSoft,
      "--color-decorative-strong": semantic.decorativeStrong,
      "--color-decorative-glow": semantic.glow,
      "--color-gradient-a": semantic.gradientA,
      "--color-gradient-b": semantic.gradientB,
      "--color-success": states.success,
      "--color-on-success": states.onSuccess,
      "--color-success-bg": states.successBg,
      "--color-warning": states.warning,
      "--color-on-warning": states.onWarning,
      "--color-warning-bg": states.warningBg,
      "--color-error": states.error,
      "--color-on-error": states.onError,
      "--color-error-bg": states.errorBg,
      "--color-info": states.info,
      "--color-on-info": states.onInfo,
      "--color-info-bg": states.infoBg,
    };

    return {
      coreRoles: { primary: p, secondary: s, tertiary: t, supplementary: q },
      semantic,
      states,
      components,
      cssVariables,
      contrastProfile: cp,
      toneProfile,
      websiteRules: WEBSITE_COLOR_RULES,
    };
  }

  function buildMoodWebsiteTheme(scoredPaletteRows, moodId, options) {
    const minPalDist = options?.minPaletteDistance ?? 0.073;
    const poolPaletteN = options?.poolPaletteLimit ?? 28;
    const deduped = dedupePalettesPerceptual(scoredPaletteRows, minPalDist);
    const rowsForPool = stratifyScoredRowsForPool(deduped, poolPaletteN);
    const mindfulPoolRows = rowsForPool.filter((r) => !rowIsPinterest(r)).length;
    const pinterestPoolRows = rowsForPool.length - mindfulPoolRows;
    const candidates = buildCandidatePool(rowsForPool);
    const candHexes = candidates.map((c) => c.hex);

    const fb = (hex) => enrichColor(hex);
    let primary = selectBest(candidates, (c) => primaryColorScore(c, moodId));
    if (!primary) primary = fb("#4F46E5");
    let secondary = selectBest(
      candidates.filter((c) => c.hex !== primary.hex),
      (c) => secondaryColorScore(c, primary, moodId),
    );
    if (!secondary) secondary = candidates.find((c) => c.hex !== primary.hex) || fb("#64748B");
    let tertiary = selectBest(
      candidates.filter((c) => c.hex !== primary.hex && c.hex !== secondary.hex),
      (c) => tertiaryColorScore(c, primary, secondary, moodId),
    );
    if (!tertiary) tertiary = candidates.find((c) => c.hex !== primary.hex && c.hex !== secondary.hex) || fb("#0EA5E9");
    let supplementary = selectBest(
      candidates.filter((c) => c.hex !== primary.hex && c.hex !== secondary.hex && c.hex !== tertiary.hex),
      (c) => supplementaryColorScore(c, primary, secondary, tertiary, moodId),
    );
    if (!supplementary) supplementary = fb("#F8FAFC");

    const onPrimary = readableOrFallback(primary.hex, candHexes, moodId);
    const onSecondary = readableOrFallback(secondary.hex, candHexes, moodId);
    const onTertiary = readableOrFallback(tertiary.hex, candHexes, moodId);
    const onSupplementary = readableOrFallback(supplementary.hex, candHexes, moodId);

    let background = chooseBackgroundColor(supplementary, moodId, candidates);
    background = enrichColor(softenOffWhitePageBackground(background.hex, primary.hex, moodId));
    const surface = chooseSurfaceColor(background, candidates);
    const onBackground = readableOrFallback(background.hex, candHexes, moodId);
    const onSurface = readableOrFallback(surface.hex, candHexes, moodId);

    const primaryVariant = makeVariant(primary.hex, moodId, "primary");
    const secondaryVariant = makeVariant(secondary.hex, moodId, "secondary");

    const why = [
      `Primary chosen for ${moodId} mood fit, chroma/lightness bands, and distinctiveness.`,
      `Secondary harmonizes (${calmAnalogous(moodId) ? "analogous" : highContrastMoods(moodId) ? "contrast" : "balanced"}) with primary.`,
      `Tertiary adds hue separation for accents and callouts.`,
      `Supplementary supports surfaces and readable layers; on-colors prefer soft black/white unless the mood calls for pure contrast.`,
      `Frontend tokens add surfaces, typography, actions, tags, components, and semantic states for light/dark + tone modes.`,
    ];

    const mode = options?.mode === "dark" ? "dark" : "light";
    const tone = options?.tone && TONE_MODES[options.tone] ? options.tone : "clear";
    const material = {
      primary: primary.hex,
      onPrimary,
      primaryVariant,
      secondary: secondary.hex,
      onSecondary,
      secondaryVariant,
      tertiary: tertiary.hex,
      onTertiary,
      supplementary: supplementary.hex,
      onSupplementary,
      background: background.hex,
      onBackground,
      surface: surface.hex,
      onSurface,
      error: "#B00020",
      onError: "#FFFFFF",
    };
    const frontend = buildWebsiteFrontendTokens(material, moodId, mode, tone, candHexes);

    return {
      mood: moodId,
      mode,
      tone,
      core: {
        primary: primary.hex,
        secondary: secondary.hex,
        tertiary: tertiary.hex,
        supplementary: supplementary.hex,
      },
      material,
      frontend,
      usage: {
        primary: "CTA, links, active states, hero accents",
        secondary: "Secondary buttons, panels, nav states, highlights",
        tertiary: "Tags, badges, charts, decorative details",
        supplementary: "Backgrounds, surfaces, text support, borders, layers",
      },
      accessibility: {
        primaryContrast: contrastRatio(primary.hex, onPrimary),
        secondaryContrast: contrastRatio(secondary.hex, onSecondary),
        tertiaryContrast: contrastRatio(tertiary.hex, onTertiary),
        supplementaryContrast: contrastRatio(supplementary.hex, onSupplementary),
        backgroundContrast: contrastRatio(background.hex, onBackground),
        surfaceContrast: contrastRatio(surface.hex, onSurface),
      },
      why,
      sourcePaletteCount: deduped.length,
      candidateColorCount: candidates.length,
      poolRowSources: { mindful: mindfulPoolRows, pinterest: pinterestPoolRows },
    };
  }

  global.MoodWebsiteTheme = {
    enrichColor,
    buildMoodWebsiteTheme,
    dedupePalettesPerceptual,
    buildCandidatePool,
    stratifyScoredRowsForPool,
    contrastRatio,
    TONE_MODES,
    MOOD_CONTRAST_PROFILE,
    WEBSITE_COLOR_RULES,
  };
})(typeof window !== "undefined" ? window : globalThis);
