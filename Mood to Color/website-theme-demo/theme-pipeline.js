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
    const ca = (paletteA.colors || []).map((c) => enrichColor(c.hex));
    const cb = (paletteB.colors || []).map((c) => enrichColor(c.hex));
    if (!ca.length || !cb.length) return 1;
    let total = 0;
    for (const a of ca) {
      let nearest = Infinity;
      for (const b of cb) nearest = Math.min(nearest, colorDistanceOKLab(a, b));
      total += nearest;
    }
    return total / ca.length;
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

  function readableOrFallback(bgHex, candidateHexes) {
    const ch = chooseOnColor(bgHex, candidateHexes);
    if (ch.contrast >= 4.5) return ch.hex;
    const w = contrastRatio(bgHex, "#FFFFFF");
    const k = contrastRatio(bgHex, "#000000");
    return w >= k ? "#FFFFFF" : "#000000";
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

  function buildCandidatePool(scoredRows, limitPalettes) {
    const pool = [];
    for (const row of scoredRows.slice(0, limitPalettes)) {
      const sc = row.score;
      for (const col of row.p.colors || []) {
        const hx = global.MoodThemePalette.normalizeHex(col.hex);
        if (!hx) continue;
        pool.push({ ...enrichColor(hx), paletteScore: sc });
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

  function buildMoodWebsiteTheme(scoredPaletteRows, moodId, options) {
    const minPalDist = options?.minPaletteDistance ?? 0.082;
    const poolPaletteN = options?.poolPaletteLimit ?? 28;
    const deduped = dedupePalettesPerceptual(scoredPaletteRows, minPalDist);
    const candidates = buildCandidatePool(deduped, poolPaletteN);
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

    const onPrimary = readableOrFallback(primary.hex, candHexes);
    const onSecondary = readableOrFallback(secondary.hex, candHexes);
    const onTertiary = readableOrFallback(tertiary.hex, candHexes);
    const onSupplementary = readableOrFallback(supplementary.hex, candHexes);

    const background = chooseBackgroundColor(supplementary, moodId, candidates);
    const surface = chooseSurfaceColor(background, candidates);
    const onBackground = readableOrFallback(background.hex, candHexes);
    const onSurface = readableOrFallback(surface.hex, candHexes);

    const primaryVariant = makeVariant(primary.hex, moodId, "primary");
    const secondaryVariant = makeVariant(secondary.hex, moodId, "secondary");

    const why = [
      `Primary chosen for ${moodId} mood fit, chroma/lightness bands, and distinctiveness.`,
      `Secondary harmonizes (${calmAnalogous(moodId) ? "analogous" : highContrastMoods(moodId) ? "contrast" : "balanced"}) with primary.`,
      `Tertiary adds hue separation for accents and callouts.`,
      `Supplementary supports surfaces and readable layers; on-colors meet WCAG where possible.`,
    ];

    return {
      mood: moodId,
      core: {
        primary: primary.hex,
        secondary: secondary.hex,
        tertiary: tertiary.hex,
        supplementary: supplementary.hex,
      },
      material: {
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
      },
      usage: {
        primary: "CTA, links, key brand",
        secondary: "Secondary controls, tabs, supporting accents",
        tertiary: "Badges, charts, callouts",
        supplementary: "Backgrounds, borders, text support",
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
    };
  }

  global.MoodWebsiteTheme = {
    enrichColor,
    buildMoodWebsiteTheme,
    dedupePalettesPerceptual,
    buildCandidatePool,
    contrastRatio,
  };
})(typeof window !== "undefined" ? window : globalThis);
