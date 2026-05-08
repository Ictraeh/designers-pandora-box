/**
 * Mood scoring v2 — identity gate × (weighted identity/hue/sat/contrast/light/temp/harmony/tags)
 * + bonuses/penalties + avoid-hue multiplier. OKLCH-based palette features.
 * Loaded before app.js; exposes buildPaletteMoodFeatures + scoreMoodDirectional on window.
 */
(function (global) {
  "use strict";

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  function linearSrgb(u) {
    return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  }

  /** sRGB 0–1 → OKLab (L,a,b) */
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

  function hueDelta(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  }

  function hueGaussian(h, target, width = 34) {
    const d = hueDelta(h, target);
    return Math.exp(-(d * d) / (2 * width * width));
  }

  function inferFamily(hslH, hslS, hslL, okL, okC, okh) {
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
    if (h < 18 || h >= 345) return "red";
    if (h < 44) return "orange";
    if (h < 98) return "yellow";
    if (h < 152) return "green";
    if (h < 198) return "teal";
    if (h < 258) return "blue";
    if (h < 302) return "purple";
    if (h < 340) return "pink";
    return "red";
  }

  function familySet(swatches) {
    const s = new Set();
    for (const w of swatches) {
      s.add(w.family);
      if (w.family === "navy") s.add("blue");
      if (w.family === "sage") {
        s.add("green");
        s.add("sage");
      }
    }
    return s;
  }

  function hasAnyFamily(set, keys) {
    for (const k of keys) {
      if (set.has(k)) return true;
    }
    return false;
  }

  function computeHueSpreadEntropy(chromaticHs) {
    if (chromaticHs.length < 2) return { spread: 0, entropy: 0 };
    let maxD = 0;
    for (let i = 0; i < chromaticHs.length; i++) {
      for (let j = i + 1; j < chromaticHs.length; j++) {
        maxD = Math.max(maxD, hueDelta(chromaticHs[i], chromaticHs[j]));
      }
    }
    const bins = new Array(12).fill(0);
    for (const h of chromaticHs) bins[Math.floor(((h % 360) / 360) * 12) % 12] += 1;
    const tot = chromaticHs.length;
    let ent = 0;
    for (const c of bins) {
      if (c <= 0) continue;
      const p = c / tot;
      ent -= p * Math.log(p + 1e-9);
    }
    const entropy = clamp01(ent / Math.log(Math.min(12, tot)));
    return { spread: maxD, entropy };
  }

  function buildPaletteMoodFeatures(hexList, hsls, tags, warmCool) {
    const swatches = [];
    for (let i = 0; i < hexList.length; i++) {
      const raw = String(hexList[i]).replace(/^#/, "");
      const [r, g, b] = [
        parseInt(raw.slice(0, 2), 16) / 255,
        parseInt(raw.slice(2, 4), 16) / 255,
        parseInt(raw.slice(4, 6), 16) / 255,
      ];
      const [h0, s0, l0] = hsls[i];
      const [oL, oa, ob] = rgbToOklab(r, g, b);
      const [okL, okC, okh] = oklabToOklch(oL, oa, ob);
      const cNorm = clamp01(okC / 0.2);
      const family = inferFamily(h0, s0, l0, okL, okC, okh);
      const isNeutral = cNorm < 0.08;
      swatches.push({
        i,
        hex: hexList[i],
        hsl: [h0, s0, l0],
        okL,
        okC,
        okh,
        cNorm,
        family,
        isNeutral,
        warmHint: h0 > 40 && h0 < 120 && s0 < 0.35,
      });
    }
    const okLs = swatches.map((s) => s.okL);
    const okCs = swatches.map((s) => s.okC);
    const meanL = okLs.reduce((a, b) => a + b, 0) / okLs.length;
    const meanC = okCs.reduce((a, b) => a + b, 0) / okCs.length;
    const minL = Math.min(...okLs);
    const maxL = Math.max(...okLs);
    const lightRange = maxL - minL;
    const maxC = Math.max(...okCs);
    const minC = Math.min(...okCs);
    const chromaRange = maxC - minC;

    let vividCount = 0;
    let mutedCount = 0;
    let pastelCount = 0;
    let neonCount = 0;
    let deepCount = 0;
    let neutralCount = 0;
    for (const s of swatches) {
      if (s.isNeutral) neutralCount++;
      if (s.cNorm > 0.58 && s.okL < 0.72) vividCount++;
      if (s.cNorm < 0.32 && !s.isNeutral) mutedCount++;
      if (s.okL > 0.72 && s.cNorm > 0.12 && s.cNorm < 0.45) pastelCount++;
      if (s.okC > 0.14 && s.cNorm > 0.72 && s.okL < 0.65) neonCount++;
      if (s.okL < 0.38 && s.cNorm > 0.08) deepCount++;
    }

    const chromaticHs = swatches.filter((s) => !s.isNeutral).map((s) => s.okh);
    const { spread: hueSpread, entropy: hueEntropy } = computeHueSpreadEntropy(chromaticHs);

    const hasDarkAnchor = minL < 0.22;
    const hasLightBase = okLs.filter((l) => l > 0.88).length >= 1;
    const hasCream = swatches.some((s) => s.family === "cream");
    const hasIvory = swatches.some((s) => s.family === "ivory");
    const hasPureWhite = swatches.some((s) => s.family === "white");
    const hasBlack = swatches.some((s) => s.family === "black");
    const lightBaseRatio = okLs.filter((l) => l > 0.85).length / okLs.length;

    const mono = chromaticHs.length <= 1 || hueSpread < 28;
    const analogous = !mono && hueSpread < 95;
    let complementary = false;
    let splitComplementary = false;
    if (chromaticHs.length >= 2) {
      for (let i = 0; i < chromaticHs.length; i++) {
        for (let j = i + 1; j < chromaticHs.length; j++) {
          const d = hueDelta(chromaticHs[i], chromaticHs[j]);
          if (d > 150 && d < 210) complementary = true;
          if (d > 120 && d < 165) splitComplementary = true;
        }
      }
    }
    const triadic = hueEntropy > 0.58 && vividCount >= 3 && chromaticHs.length >= 3;
    const natural = analogous && meanC < 0.14;
    const restrained = hueEntropy < 0.48 && vividCount <= 2;
    const highContrast = tags.contrast > 0.65;
    const darkHarm = hasDarkAnchor && meanL < 0.45;
    const minimalHarm = neutralCount >= 4;

    const harmony = {
      mono,
      analogous,
      complementary,
      splitComplementary,
      triadic,
      natural,
      restrained,
      highContrast,
      dark: darkHarm,
      minimal: minimalHarm,
      rainbow: hueEntropy > 0.68,
    };

    const fam = familySet(swatches);
    const tagSignals = {
      pastel: tags.pastel,
      neon: tags.neon,
      bright: tags.bright,
      muted: tags.muted,
      deep: tags.deep,
      airy: tags.airy,
      sharp: tags.sharp,
      soft: tags.soft,
      earthy: tags.earthy,
      metallic: tags.metallic,
      maximal: tags.maximal,
      monochrome: tags.monochrome,
      clean: clamp01(0.5 * tags.airy + 0.45 * (1 - tags.earthy * 0.8)),
      structured: clamp01(tags.sharp * 0.55 + (1 - hueEntropy) * 0.45),
      corporate: clamp01((tags.sharp + tags.monochrome) * 0.45 * (1 - tags.bright * 0.6)),
      candy: clamp01(tags.pastel * tags.bright),
      warm: clamp01((warmCool + 1) / 2),
      cool: clamp01((1 - warmCool) / 2),
      icy: clamp01(tags.airy * clamp01(1 - warmCool)),
      muddy: clamp01(tags.muted * (0.5 + tags.earthy)),
      jewel: clamp01(fam.has("purple") || fam.has("hotPink") ? 0.55 : 0) + clamp01(fam.has("navy") ? 0.15 : 0),
      minimalTag: clamp01(neutralCount >= 4 ? 0.35 + tags.monochrome * 0.65 : tags.monochrome * 0.5),
      festival: tags.maximal * tags.neon,
      urgent: clamp01(tags.sharp * 0.5 + tags.bright * 0.45),
      chaotic: clamp01(hueEntropy * (tags.maximal || 0)),
      lowContrast: clamp01(1 - tags.contrast),
      pastelOnly: clamp01(tags.pastel * (1 - Math.min(1, vividCount * 0.35))),
      darkHeavy: clamp01((1 - meanL) * 0.65 + (hasDarkAnchor ? 0.25 : 0)),
      sunny: clamp01(fam.has("yellow") ? 0.55 + meanL * 0.3 : meanL * 0.35),
      colorful: clamp01(hueEntropy * 0.55 + vividCount * 0.12),
      highHueEntropy: hueEntropy,
      blush: fam.has("pink") || fam.has("hotPink") ? 0.72 : tags.pastel * 0.35,
      ivory: hasIvory ? 0.88 : tags.pastel * 0.22,
      champagne: clamp01(tags.metallic * (hasCream || hasIvory ? 0.85 : 0.35)),
      sage: fam.has("sage") || (fam.has("green") && meanC < 0.18) ? 0.58 : 0,
      pearl: clamp01((hasIvory || hasPureWhite) * tags.soft * 0.9),
    };

    const chromW = swatches.map((s) => (s.isNeutral ? 0.15 : s.cNorm * (0.55 + 0.45 * s.okL)));
    const maxCW = Math.max(...chromW, 1e-6);
    const minLi = okLs.indexOf(minL);
    const maxLi = okLs.indexOf(maxL);
    for (let i = 0; i < swatches.length; i++) {
      let rw = 1;
      if (chromW[i] >= maxCW * 0.92) rw *= 1.22;
      if (i === minLi && minL < 0.28) rw *= 1.12;
      if (i === maxLi && maxL > 0.88) rw *= 1.06;
      if (swatches[i].isNeutral) rw *= 0.78;
      swatches[i].roleWeight = rw;
    }

    const features = {
      meanL,
      minL,
      maxL,
      lightRange,
      meanC,
      maxC,
      minC,
      chromaRange,
      vividCount,
      mutedCount,
      pastelCount,
      neonCount,
      deepCount,
      neutralCount,
      warmCool,
      contrast: tags.contrast,
      hueEntropy,
      hueSpread,
      hasDarkAnchor,
      hasLightBase,
      hasCream,
      hasPureWhite,
      hasBlack,
      hasIvory,
      lightBaseRatio,
    };

    return { features, swatches, harmony, tagSignals, hueEntropy };
  }

  const DEFAULT_W = {
    identity: 0.34,
    hue: 0.22,
    saturation: 0.13,
    contrast: 0.12,
    lightness: 0.09,
    temperature: 0.06,
    harmony: 0.07,
    tags: 0.07,
  };

  const BAND_SOFT = {
    urgent: { sat: 0.1, contrast: 0.1, light: 0.22 },
    energy: { sat: 0.085, contrast: 0.085, light: 0.17 },
    calm: { sat: 0.12, contrast: 0.12, light: 0.2 },
    lux: { sat: 0.2, contrast: 0.16, light: 0.22 },
    festival: { sat: 0.08, contrast: 0.14, light: 0.22 },
    joy: { sat: 0.09, contrast: 0.11, light: 0.12 },
    pure: { sat: 0.07, contrast: 0.18, light: 0.26 },
    dawn: { sat: 0.12, contrast: 0.13, light: 0.13 },
    tech: { sat: 0.11, contrast: 0.11, light: 0.14 },
    clinical: { sat: 0.1, contrast: 0.12, light: 0.15 },
    default: { sat: 0.16, contrast: 0.18, light: 0.2 },
  };

  function bandSoft(val, lo, hi, sigma) {
    if (val >= lo && val <= hi) return 1;
    if (val < lo) return Math.exp(-Math.pow((lo - val) / sigma, 2));
    return Math.exp(-Math.pow((val - hi) / sigma, 2));
  }

  function normWeights(w) {
    const base = { ...DEFAULT_W, ...w };
    const s =
      base.identity +
      base.hue +
      base.saturation +
      base.contrast +
      base.lightness +
      base.temperature +
      base.harmony +
      base.tags;
    const k = 1 / s;
    for (const key of Object.keys(base)) base[key] *= k;
    return base;
  }

  function mp(tg, av, sat, li, co, tmp, har, btag, atag, w) {
    return {
      targetHues: tg,
      avoidHues: av || [],
      sat,
      light: li,
      contrast: co,
      temp: tmp,
      harmony: har || [],
      bonusTags: btag || [],
      avoidTags: atag || [],
      weights: w ? normWeights(w) : null,
    };
  }

  const MOOD_PROFILES_V2 = {
    calm: mp([205, 178, 140, 260], [0, 25, 55], [0.08, 0.45], [0.48, 0.88], [0.05, 0.42], -0.55, ["mono", "analogous"], ["soft", "pastel", "airy", "muted"], ["neon", "sharp", "maximal"], {
      identity: 0.3,
      hue: 0.24,
      saturation: 0.16,
      contrast: 0.15,
      lightness: 0.08,
      temperature: 0.08,
      harmony: 0.14,
      tags: 0.08,
    }),
    trust: mp([215, 225, 195, 185], [330, 0, 55], [0.22, 0.62], [0.35, 0.82], [0.35, 0.72], -0.45, ["mono", "analogous"], ["clean", "structured", "cool"], ["chaotic", "festival", "muddy"]),
    energy: mp(
      [0, 15, 28, 55, 105, 200, 330, 300, 285],
      [40, 95, 118, 132],
      [0.46, 1],
      [0.38, 0.9],
      [0.44, 1],
      0.22,
      ["complementary", "splitComplementary", "triadic", "highContrast"],
      ["bright", "neon", "sharp", "maximal", "urgent", "festival", "colorful"],
      ["muted", "lowContrast", "pastelOnly", "earthy", "muddy", "soft"],
      {
        identity: 0.32,
        hue: 0.18,
        saturation: 0.24,
        contrast: 0.2,
        lightness: 0.06,
        temperature: 0.04,
        harmony: 0.08,
        tags: 0.14,
      },
    ),
    play: mp([330, 55, 160, 270, 25, 205], [225, 0], [0.35, 0.85], [0.55, 0.95], [0.22, 0.68], 0.15, ["triadic", "splitComplementary"], ["pastel", "bright", "candy"], ["corporate", "darkHeavy", "muddy"]),
    lux: mp([45, 140, 350, 275, 225, 30], [60, 105, 190], [0.18, 0.72], [0.12, 0.78], [0.38, 0.86], 0.05, ["mono", "analogous"], ["deep", "metallic", "jewel", "muted"], ["candy", "festival", "neon"], {
      identity: 0.3,
      hue: 0.2,
      saturation: 0.1,
      contrast: 0.14,
      lightness: 0.12,
      temperature: 0.04,
      harmony: 0.1,
      tags: 0.14,
    }),
    earth: mp([95, 120, 28, 38, 45, 25], [190, 205, 300], [0.16, 0.55], [0.28, 0.78], [0.18, 0.58], 0.35, ["analogous", "natural"], ["muted", "earthy", "soft"], ["neon", "icy", "clinical"]),
    melancholy: mp([215, 235, 265, 185, 330], [55, 35, 120], [0.05, 0.38], [0.18, 0.62], [0.08, 0.48], -0.35, ["mono", "analogous"], ["muted", "deep", "soft"], ["bright", "neon", "sunny"]),
    joy: mp(
      [42, 24, 12, 55, 335, 200, 318, 285],
      [118, 132, 245],
      [0.36, 0.92],
      [0.52, 0.96],
      [0.24, 0.72],
      0.3,
      ["triadic", "splitComplementary", "complementary"],
      ["bright", "sunny", "airy", "candy", "colorful"],
      ["darkHeavy", "muddy", "muted", "pastelOnly", "earthy"],
      {
        identity: 0.34,
        hue: 0.22,
        saturation: 0.18,
        contrast: 0.12,
        lightness: 0.1,
        temperature: 0.06,
        harmony: 0.08,
        tags: 0.08,
      },
    ),
    romance: mp([345, 335, 0, 320, 275, 25], [110, 185, 205], [0.18, 0.62], [0.46, 0.9], [0.12, 0.55], 0.28, ["analogous"], ["soft", "pastel", "muted"], ["clinical", "neon", "sharp"]),
    clinical: mp(
      [188, 198, 208, 218, 228, 238, 248, 262],
      [25, 35, 48, 55, 95, 330, 20],
      [0.03, 0.4],
      [0.52, 0.98],
      [0.22, 0.72],
      -0.58,
      ["mono", "analogous"],
      ["clean", "airy", "sharp", "icy"],
      ["muddy", "earthy", "warm", "candy", "blush", "sunny", "pastelOnly"],
      {
        identity: 0.32,
        hue: 0.3,
        saturation: 0.11,
        contrast: 0.12,
        lightness: 0.09,
        temperature: 0.1,
        harmony: 0.08,
        tags: 0.1,
      },
    ),
    tech: mp(
      [188, 200, 210, 220, 232, 248, 268],
      [28, 40, 52, 32, 20, 328, 352],
      [0.24, 0.86],
      [0.18, 0.86],
      [0.32, 0.92],
      -0.48,
      ["mono", "analogous"],
      ["neon", "sharp", "cool", "structured", "corporate", "clean", "metallic"],
      ["muddy", "earthy", "warm", "blush", "champagne", "sage", "sunny", "pastelOnly", "candy", "soft"],
      {
        identity: 0.36,
        hue: 0.22,
        saturation: 0.13,
        contrast: 0.12,
        lightness: 0.07,
        temperature: 0.08,
        harmony: 0.08,
        tags: 0.1,
      },
    ),
    cozy: mp([28, 35, 22, 15, 45, 330], [190, 205, 220], [0.14, 0.55], [0.34, 0.86], [0.12, 0.52], 0.65, ["analogous"], ["soft", "muted", "warm"], ["icy", "clinical", "neon"]),
    crisp: mp([200, 190, 165, 220], [25, 35, 0], [0.02, 0.32], [0.72, 0.99], [0.18, 0.58], -0.75, ["mono", "analogous"], ["airy", "clean", "icy"], ["warm", "muddy", "darkHeavy"]),
    noir: mp([0, 350, 225, 260, 45], [55, 120, 160, 200], [0.08, 0.65], [0.05, 0.48], [0.45, 0.95], -0.1, ["mono", "dark"], ["deep", "sharp", "muted"], ["pastel", "airy", "sunny"]),
    nostalgia: mp([45, 20, 5, 205, 90, 30], [185, 300, 120], [0.12, 0.52], [0.35, 0.82], [0.16, 0.58], 0.28, ["analogous"], ["muted", "earthy", "warm"], ["neon", "clinical", "clean"]),
    pure: mp([], [], [0, 0.18], [0.25, 0.98], [0.28, 0.82], 0, ["mono", "minimal"], ["monochrome", "airy", "minimalTag"], ["colorful", "festival", "neon"]),
    urgent: mp([0, 15, 30, 55, 330, 105], [140, 180, 205, 260], [0.62, 1], [0.38, 0.9], [0.62, 1], 0.65, ["complementary", "highContrast"], ["bright", "neon", "sharp"], ["muted", "pastelOnly", "lowContrast"], {
      identity: 0.42,
      hue: 0.24,
      saturation: 0.15,
      contrast: 0.13,
      lightness: 0.03,
      temperature: 0.02,
      harmony: 0.01,
      tags: 0.1,
    }),
    ocean: mp([185, 195, 205, 215, 175], [0, 25, 330], [0.18, 0.68], [0.38, 0.9], [0.18, 0.68], -0.55, ["analogous"], ["airy", "muted", "cool"], ["warm", "muddy"]),
    forest: mp([120, 135, 100, 155, 30], [300, 330, 190], [0.12, 0.55], [0.16, 0.65], [0.18, 0.62], -0.1, ["analogous", "natural"], ["deep", "earthy", "muted"], ["neon", "candy"]),
    midnight: mp([225, 235, 250, 215, 260], [55, 35, 25], [0.12, 0.62], [0.04, 0.42], [0.32, 0.82], -0.55, ["mono", "dark"], ["deep", "cool", "sharp"], ["sunny", "pastel", "bright"]),
    dawn: mp(
      [18, 28, 42, 52, 330, 345, 285, 302, 318],
      [200, 215, 225, 235, 118, 138],
      [0.07, 0.44],
      [0.68, 0.97],
      [0.07, 0.46],
      0.34,
      ["analogous"],
      ["pastel", "airy", "soft", "blush", "champagne", "cream"],
      ["darkHeavy", "neon", "sharp", "deep", "muddy"],
      {
        identity: 0.36,
        hue: 0.24,
        saturation: 0.12,
        contrast: 0.1,
        lightness: 0.14,
        temperature: 0.08,
        harmony: 0.09,
        tags: 0.09,
      },
    ),
    festival: mp([300, 190, 55, 25, 270, 110, 330], [], [0.58, 1], [0.42, 0.92], [0.48, 1], 0.1, ["triadic", "rainbow"], ["maximal", "bright", "neon"], ["minimalTag", "muted", "monochrome"]),
    wedding: mp(
      [345, 330, 40, 90, 25, 50],
      [105, 190, 220],
      [0.04, 0.42],
      [0.68, 0.98],
      [0.08, 0.48],
      0.22,
      ["analogous"],
      ["pastel", "soft", "metallic", "ivory", "blush", "champagne", "sage", "pearl"],
      ["neon", "urgent", "darkHeavy"],
    ),
    artisan: mp([25, 35, 45, 220, 95, 15], [185, 300, 110], [0.12, 0.56], [0.28, 0.82], [0.16, 0.62], 0.32, ["analogous", "natural"], ["muted", "earthy", "warm"], ["clinical", "neon", "icy"]),
  };

  function hueFitV2(profile, swatches) {
    if (!profile.targetHues.length) return 1;
    let num = 0;
    let den = 0;
    for (const s of swatches) {
      if (s.isNeutral) continue;
      const chromaW = 0.55 + 0.45 * s.cNorm;
      let best = 0;
      for (const th of profile.targetHues) best = Math.max(best, hueGaussian(s.okh, th, 34));
      num += best * s.roleWeight * chromaW;
      den += s.roleWeight * chromaW;
    }
    return den > 0 ? clamp01(num / den) : 0.25;
  }

  function avoidHueMult(profile, swatches) {
    if (!profile.avoidHues.length) return 1;
    let avoidPresence = 0;
    let wsum = 0;
    for (const s of swatches) {
      if (s.isNeutral) continue;
      const cw = s.roleWeight * (0.55 + 0.45 * s.cNorm);
      let worst = 0;
      for (const ah of profile.avoidHues) worst = Math.max(worst, hueGaussian(s.okh, ah, 28));
      avoidPresence += worst * cw;
      wsum += cw;
    }
    avoidPresence = wsum > 0 ? clamp01(avoidPresence / (wsum * 1.15)) : 0;
    return clamp01(1 - avoidPresence * 0.55);
  }

  function harmonyFit(profile, harmony, tags) {
    let score = 0.42;
    const h = profile.harmony || [];
    for (const name of h) {
      if (name === "mono" && harmony.mono) score += 0.18;
      if (name === "analogous" && harmony.analogous) score += 0.16;
      if (name === "complementary" && harmony.complementary) score += 0.14;
      if (name === "splitComplementary" && harmony.splitComplementary) score += 0.12;
      if (name === "triadic" && harmony.triadic) score += 0.14;
      if (name === "natural" && harmony.natural) score += 0.14;
      if (name === "minimal" && harmony.minimal) score += 0.18;
      if (name === "highContrast" && harmony.highContrast) score += 0.16;
      if (name === "rainbow" && harmony.rainbow) score += 0.18;
      if (name === "dark" && harmony.dark) score += 0.12;
    }
    if (h.includes("highContrast") && tags.contrast > 0.72) score += 0.06;
    return clamp01(score);
  }

  function tagFitV2(profile, tagSignals) {
    let score = 0.5;
    for (const t of profile.bonusTags || []) score += 0.1 * (tagSignals[t] ?? 0);
    for (const t of profile.avoidTags || []) score -= 0.13 * (tagSignals[t] ?? 0);
    const x = clamp01(score);
    return Number.isFinite(x) ? x : 0.5;
  }

  /** True when the palette has a recognizable sunrise “skyline” (not brown/gold-only neutrals). */
  function dawnHasSkyline(fam, f) {
    if (hasAnyFamily(fam, ["pink", "purple"])) return true;
    if ((hasAnyFamily(fam, ["orange"]) || hasAnyFamily(fam, ["red"])) && f.meanL > 0.64) return true;
    if (hasAnyFamily(fam, ["yellow"]) && f.meanC < 0.36 && f.meanL > 0.74) return true;
    return false;
  }

  /**
   * Clinical = **blue-led** with clean support tones (white, black/grey, teal/green).
   * One red accent is acceptable; red should not become the dominant chromatic story.
   */
  function clinicalWhiteBlueDominance(swatches, f) {
    const blueFamilies = new Set(["blue", "cyan", "navy", "teal"]);
    const warmAccentFamilies = new Set(["pink", "hotPink", "orange", "yellow", "brown", "gold", "purple"]);
    const competingGreenFamilies = new Set(["green", "sage", "moss"]);

    /** Azure / cyan / navy — not muddy teal-green or lavender-purple as the “clear blue” hero. */
    function isClearBlueSwatch(s) {
      const h = s.okh;
      const fam = s.family;
      if (fam === "blue" || fam === "navy" || fam === "cyan") return true;
      if (fam === "teal") return h >= 198;
      if (warmAccentFamilies.has(fam) || competingGreenFamilies.has(fam)) return false;
      return h >= 200 && h <= 268;
    }

    let whiteScore = 0;
    let chromW = 0;
    let blueW = 0;
    let clearBlueW = 0;
    let warmAccentW = 0;
    let greenCompeteW = 0;
    let redAccentW = 0;
    let redAccentCount = 0;
    let maxBlueChroma = 0;
    let maxClearBlueChroma = 0;

    for (const s of swatches) {
      const h = s.okh;
      const isWhiteLike =
        s.family === "white" ||
        s.family === "ivory" ||
        (s.okL >= 0.9 && s.cNorm < 0.12) ||
        ((s.isNeutral || s.cNorm < 0.085) && s.okL >= 0.88);
      if (isWhiteLike) {
        whiteScore += s.family === "white" || s.family === "ivory" ? 1.15 : 0.72;
        continue;
      }
      if (s.isNeutral && s.okL < 0.88) continue;

      if (!s.isNeutral && s.cNorm >= 0.055) {
        const w = Math.max(0.12, s.roleWeight) * (0.42 + 0.58 * s.cNorm);
        chromW += w;
        const inBlueStory =
          blueFamilies.has(s.family) ||
          (h >= 192 &&
            h <= 252 &&
            !competingGreenFamilies.has(s.family) &&
            !warmAccentFamilies.has(s.family) &&
            s.family !== "purple");
        if (inBlueStory) {
          blueW += w;
          maxBlueChroma = Math.max(maxBlueChroma, s.okC);
        }
        if (isClearBlueSwatch(s)) {
          clearBlueW += w;
          maxClearBlueChroma = Math.max(maxClearBlueChroma, s.okC);
        }
        const redLike = s.family === "red" || ((h >= 348 || h <= 12) && s.cNorm > 0.1);
        if (redLike) {
          redAccentW += w;
          redAccentCount += 1;
        }
        if (
          warmAccentFamilies.has(s.family) ||
          (h < 62 && h >= 0 && s.cNorm > 0.1 && !blueFamilies.has(s.family) && !redLike)
        ) {
          warmAccentW += w;
        }
        if (competingGreenFamilies.has(s.family) || (h >= 88 && h < 165 && s.cNorm > 0.1)) {
          greenCompeteW += w * 0.35;
        }
      }
    }

    const attributeChromW = Math.max(0, chromW - clearBlueW);
    const hasWhiteKey = Boolean(
      f.hasPureWhite ||
        f.lightBaseRatio > 0.36 ||
        whiteScore >= 0.88 ||
        (whiteScore >= 0.58 && f.lightBaseRatio > 0.3),
    );
    const hasClearBlue =
      maxClearBlueChroma >= 0.048 ||
      (clearBlueW >= 0.2 && maxClearBlueChroma >= 0.034) ||
      (clearBlueW >= 0.14 && maxClearBlueChroma >= 0.042);
    const blueLeadRatio = chromW > 0.028 ? clearBlueW / chromW : clearBlueW > 0 ? 1 : 0;
    const storyDominatesAccents = attributeChromW <= Math.max(clearBlueW * 1.05, 0.12);

    return {
      hasWhiteKey,
      hasClearBlue,
      blueLeadRatio,
      whiteScore,
      chromW,
      blueW,
      clearBlueW,
      attributeChromW,
      storyDominatesAccents,
      warmAccentW,
      greenCompeteW,
      redAccentW,
      redAccentCount,
      maxBlueChroma,
      maxClearBlueChroma,
    };
  }

  function identityScoreFn(moodId, f, swatches, m) {
    const fam = familySet(swatches);
    const coolMass = (m.blueTrust || 0) + (m.tealOcean || 0) * 0.85 + (m.greenForest || 0) * 0.35;
    let warmMass = (m.warmAlert || 0) * 0.45;
    if (typeof global.urgentWarmMass === "function") {
      try {
        warmMass += global.urgentWarmMass(swatches.map((s) => s.hsl)) * 0.55;
      } catch {
        /* ignore */
      }
    }
    switch (moodId) {
      case "urgent":
        return clamp01(0.48 * warmMass + 0.28 * f.contrast + 0.24 * Math.min(1, f.meanC * 1.35));
      case "energy": {
        const pr = MOOD_PROFILES_V2.energy;
        const hf = hueFitV2(pr, swatches);
        const tc = 1 - Math.min(1, Math.abs(f.warmCool - pr.temp) / 1.45);
        const cs = bandSoft(f.meanC, pr.sat[0], pr.sat[1], 0.1);
        const co = bandSoft(f.contrast, pr.contrast[0], pr.contrast[1], 0.1);
        const electric =
          f.neonCount >= 1 ||
          f.vividCount >= 3 ||
          (f.vividCount >= 2 && f.meanC > 0.5);
        const flat =
          f.meanC < 0.44 &&
          f.neonCount < 1 &&
          f.vividCount < 2 &&
          f.contrast < 0.54;
        let s = 0.34 * hf + 0.32 * cs + 0.24 * co + 0.1 * tc;
        if (electric) s += 0.2;
        if (flat) s *= 0.32;
        if (hasAnyFamily(fam, ["brown", "sage"]) && f.meanC < 0.5 && f.neonCount < 1) s *= 0.42;
        s += 0.1 * Math.min(1, warmMass * 1.15);
        return clamp01(s);
      }
      case "calm":
        return clamp01(0.65 * coolMass + 0.2 * (1 - f.contrast) + 0.15 * (1 - f.meanC * 2));
      case "trust":
        return clamp01((m.blueTrust + m.tealOcean * 0.8) / 1.8 + 0.2 * f.contrast);
      case "lux":
        return clamp01(0.45 * (f.hasDarkAnchor || f.hasIvory || f.hasCream ? 1 : 0.55) + 0.35 * (1 - f.hueEntropy) + 0.2 * (m.deepShadow * 0.5 + m.goldChampagne * 0.4));
      case "clinical": {
        const cb = clinicalWhiteBlueDominance(swatches, f);
        const wb = clamp01(0.24 + 0.76 * (cb.hasWhiteKey ? clamp01(cb.whiteScore / 1.65) : 0.24));
        const chromaPeak = Math.max(cb.maxClearBlueChroma / 0.072, cb.maxBlueChroma / 0.085);
        const blueDom =
          clamp01(0.14 + 0.86 * cb.blueLeadRatio) * clamp01(Math.min(1.2, chromaPeak));
        const coolT = 1 - Math.min(1, Math.abs(f.warmCool - -0.58) / 1.38);
        const massHint = clamp01(((m.blueTrust || 0) + (m.cyanClinical || 0) * 1.08) * 0.42);
        let s = 0.36 * wb + 0.4 * blueDom + 0.1 * coolT + 0.07 * massHint + 0.07 * f.contrast;
        if (!cb.hasClearBlue) s *= 0.52;
        if (!cb.hasWhiteKey) s *= 0.58;
        if (!cb.storyDominatesAccents) s *= 0.64;
        if (cb.warmAccentW > Math.max(cb.clearBlueW, 0.055) * 1.12) s *= 0.68;
        if (cb.greenCompeteW > Math.max(cb.clearBlueW, 0.055) * 1.35) s *= 0.78;
        if (cb.redAccentCount > 1 && cb.redAccentW > Math.max(cb.clearBlueW, 0.055) * 0.78) s *= 0.7;
        if (hasAnyFamily(fam, ["pink", "hotPink"]) && cb.blueLeadRatio < 0.55) s *= 0.68;
        return clamp01(s);
      }
      case "festival":
        return clamp01(0.45 * f.hueEntropy + 0.35 * Math.min(1, f.vividCount * 0.22) + 0.2 * f.contrast);
      case "pure": {
        const neutralFit =
          f.neutralCount >= 4
            ? 1
            : f.neutralCount === 3 && f.meanC < 0.16 && f.hueEntropy < 0.42
              ? 0.82
              : 0.38;
        return clamp01(0.52 * neutralFit + 0.48 * (1 - f.hueEntropy));
      }
      case "forest":
        return clamp01(hasAnyFamily(fam, ["green", "sage", "moss", "teal"]) ? 0.75 + f.meanC * 0.25 : 0.25);
      case "ocean":
        return clamp01(hasAnyFamily(fam, ["blue", "navy", "teal", "cyan"]) ? 0.82 : 0.28);
      case "joy": {
        const pr = MOOD_PROFILES_V2.joy;
        const hf = hueFitV2(pr, swatches);
        const tc = 1 - Math.min(1, Math.abs(f.warmCool - pr.temp) / 1.5);
        const cs = bandSoft(f.meanC, pr.sat[0], pr.sat[1], 0.11);
        const ls = bandSoft(f.meanL, pr.light[0], pr.light[1], 0.11);
        const partyMix =
          hasAnyFamily(fam, ["pink", "orange", "yellow", "cyan", "blue", "purple", "hotPink"]) ||
          f.hueEntropy > 0.52;
        const greenNeonWall =
          f.hueSpread < 62 &&
          hasAnyFamily(fam, ["green", "yellow"]) &&
          !hasAnyFamily(fam, ["pink", "orange", "red", "hotPink", "blue", "cyan", "purple"]);
        const mudDull =
          f.meanC < 0.32 &&
          (hasAnyFamily(fam, ["brown", "sage", "grey"]) || f.neutralCount >= 4);
        const harshNeonMud =
          f.neonCount >= 2 && (f.deepCount >= 2 || hasAnyFamily(fam, ["brown", "moss"])) && f.meanL < 0.6;
        let s = 0.36 * hf + 0.28 * cs + 0.2 * ls + 0.16 * tc;
        if (partyMix) s += 0.16;
        if (greenNeonWall) s *= 0.4;
        if (mudDull) s *= 0.42;
        if (harshNeonMud) s *= 0.4;
        return clamp01(s);
      }
      case "wedding":
        return clamp01(
          (hasAnyFamily(fam, ["ivory", "cream", "pink", "rose", "gold", "sage", "white"]) ? 0.72 : 0.3) + 0.28 * (1 - f.contrast * 0.4),
        );
      case "tech": {
        const pr = MOOD_PROFILES_V2.tech;
        const hf = hueFitV2(pr, swatches);
        const tc = 1 - Math.min(1, Math.abs(f.warmCool - pr.temp) / 1.45);
        const cs = bandSoft(f.meanC, pr.sat[0], pr.sat[1], 0.13);
        const hasBlueFamily = hasAnyFamily(fam, ["blue", "navy", "cyan"]);
        const hasCoolLane = hasAnyFamily(fam, ["cyan", "teal"]);
        /* Pastel pink/violet “wellness” sets often add one aqua swatch — do not treat as full digital stack. */
        const weakDigitalPastelNoise =
          f.pastelCount >= 3 &&
          f.meanC < 0.33 &&
          hasAnyFamily(fam, ["pink", "hotPink"]) &&
          f.neonCount < 1;
        /* Require a “digital” cool spine (cyan/teal + blue/navy), neon punch, or teal+navy — not pink+purple+blue alone. */
        const digitalStack =
          hasBlueFamily &&
          !weakDigitalPastelNoise &&
          (f.neonCount >= 1 ||
            (hasCoolLane && hasAnyFamily(fam, ["blue", "navy"])) ||
            (hasAnyFamily(fam, ["teal", "navy"]) && hasCoolLane));
        const earthWarm =
          hasAnyFamily(fam, ["brown", "orange", "gold"]) && f.warmCool > -0.1;
        const softPastelRomance =
          f.pastelCount >= 2 &&
          f.meanC < 0.38 &&
          hasAnyFamily(fam, ["pink", "hotPink", "red"]) &&
          f.neonCount < 1 &&
          !(hasCoolLane && f.meanC > 0.2);
        const sunsetWide =
          f.hueSpread > 105 &&
          hasAnyFamily(fam, ["pink", "hotPink", "red", "purple"]) &&
          !hasAnyFamily(fam, ["cyan"]) &&
          f.neonCount < 1 &&
          f.meanC < 0.45;
        const digitalLaneMass = (m.blueTrust || 0) + (m.tealOcean || 0) * 1.05 + (m.cyanClinical || 0) * 1.05;
        const floralPastelLowDigital =
          f.pastelCount >= 4 &&
          f.meanC < 0.38 &&
          hasAnyFamily(fam, ["pink", "purple"]) &&
          f.neonCount < 1 &&
          f.vividCount < 2 &&
          digitalLaneMass < 0.48;
        let s = 0.44 * hf + 0.3 * cs + 0.26 * tc;
        if (digitalStack) s += 0.14;
        if (earthWarm) s *= 0.38;
        if (softPastelRomance) s *= hasBlueFamily ? 0.45 : 0.32;
        if (sunsetWide) s *= 0.42;
        if (floralPastelLowDigital) s *= 0.34;
        return clamp01(s);
      }
      case "dawn": {
        const pr = MOOD_PROFILES_V2.dawn;
        const hf = hueFitV2(pr, swatches);
        const tc = 1 - Math.min(1, Math.abs(f.warmCool - pr.temp) / 1.45);
        const ls = bandSoft(f.meanL, pr.light[0], pr.light[1], 0.11);
        const cs = bandSoft(f.meanC, pr.sat[0], pr.sat[1], 0.13);
        const sky = dawnHasSkyline(fam, f);
        const coolDominant =
          hasAnyFamily(fam, ["blue", "cyan", "teal", "navy"]) &&
          !hasAnyFamily(fam, ["pink", "orange", "yellow", "purple", "red", "cream", "ivory"]);
        const brownStack =
          hasAnyFamily(fam, ["brown"]) &&
          !hasAnyFamily(fam, ["pink", "purple"]) &&
          f.meanL < 0.76;
        let s = 0.4 * hf + 0.22 * cs + 0.2 * ls + 0.18 * tc;
        if (sky) s += 0.16;
        if (coolDominant) s *= 0.35;
        if (brownStack) s *= 0.45;
        if (f.neonCount >= 2) s *= 0.55;
        if (f.vividCount >= 4 && f.meanC > 0.42) s *= 0.62;
        return clamp01(s);
      }
      default: {
        const pr = MOOD_PROFILES_V2[moodId];
        if (!pr) return 0.5;
        const hf = hueFitV2(pr, swatches);
        const tc = 1 - Math.min(1, Math.abs(f.warmCool - pr.temp) / 1.5);
        return clamp01(0.52 * hf + 0.28 * bandSoft(f.meanC, pr.sat[0], pr.sat[1], 0.16) + 0.2 * tc);
      }
    }
  }

  function identityGateFn(moodId, f, swatches, m) {
    const fam = familySet(swatches);
    switch (moodId) {
      case "urgent": {
        const alert =
          hasAnyFamily(fam, ["red", "orange", "yellow", "hotPink"]) || f.neonCount >= 1;
        if (!alert && f.contrast < 0.62) return 0.45;
        if (!alert) return 0.58;
        if (f.contrast < 0.5) return 0.68;
        return 1;
      }
      case "energy": {
        const punch =
          f.neonCount >= 1 ||
          f.vividCount >= 2 ||
          (f.meanC > 0.5 && f.contrast > 0.5) ||
          hasAnyFamily(fam, ["red", "orange", "yellow", "hotPink", "cyan"]);
        if (!punch) return 0.46;
        if (f.meanC < 0.42 && f.neonCount < 1 && f.vividCount < 2) return 0.54;
        if (f.pastelCount >= 4 && f.neonCount < 1 && f.meanC < 0.48) return 0.52;
        if (f.neutralCount >= 4 && f.meanC < 0.46 && f.neonCount < 1) return 0.53;
        return 1;
      }
      case "calm": {
        const cool = hasAnyFamily(fam, ["blue", "teal", "sage", "green", "cyan", "purple"]) || f.warmCool < -0.05;
        const lowNoise = f.meanC < 0.46 && f.contrast < 0.5;
        if (!cool && f.warmCool > 0.35) return 0.55;
        if (!lowNoise) return 0.62;
        return 1;
      }
      case "trust": {
        const t = hasAnyFamily(fam, ["blue", "navy", "teal", "cyan", "grey"]);
        if (!t) return 0.62;
        if (f.contrast < 0.25) return 0.72;
        return 1;
      }
      case "lux": {
        const base = f.hasBlack || f.hasDarkAnchor || f.hasCream || f.hasIvory;
        const restrained = f.hueEntropy < 0.58 || f.neutralCount >= 2;
        if (!base) return 0.68;
        if (!restrained && f.vividCount >= 4) return 0.58;
        return 1;
      }
      case "clinical": {
        const cb = clinicalWhiteBlueDominance(swatches, f);
        if (!cb.hasWhiteKey) return 0.46;
        if (!cb.hasClearBlue) return 0.4;
        if (cb.chromW > 0.07 && cb.blueLeadRatio < 0.36) return 0.48;
        if (!cb.storyDominatesAccents && cb.attributeChromW > 0.2) return 0.52;
        if (cb.warmAccentW > cb.clearBlueW * 1.2 && cb.warmAccentW > 0.16) return 0.52;
        if (cb.greenCompeteW > cb.clearBlueW * 1.45 && cb.greenCompeteW > 0.14) return 0.54;
        if (cb.redAccentCount > 1 && cb.redAccentW > cb.clearBlueW * 0.82) return 0.54;
        const coolBlueFam = hasAnyFamily(fam, ["blue", "cyan", "teal", "navy"]);
        const blueMass = (m.blueTrust || 0) + (m.cyanClinical || 0) * 1.05 + (m.tealOcean || 0) * 0.75;
        if (!coolBlueFam && blueMass < 0.12 && cb.blueLeadRatio < 0.48) return 0.48;
        if (f.warmCool > 0.22 && cb.blueLeadRatio < 0.48) return 0.52;
        return 1;
      }
      case "festival": {
        if (f.hueEntropy < 0.5 || f.vividCount < 3) return 0.55;
        return 1;
      }
      case "pure": {
        if (f.neutralCount < 3) return 0.44;
        if (f.neutralCount === 3 && (f.hueEntropy > 0.45 || f.meanC > 0.24)) return 0.54;
        if (f.neutralCount >= 4 && f.hueEntropy > 0.38) return 0.56;
        return 1;
      }
      case "forest": {
        if (!hasAnyFamily(fam, ["green", "sage", "moss", "teal"])) return 0.52;
        return 1;
      }
      case "ocean": {
        if (!hasAnyFamily(fam, ["blue", "navy", "teal", "cyan"])) return 0.52;
        return 1;
      }
      case "joy": {
        const upbeat =
          f.vividCount >= 2 ||
          f.meanC > 0.44 ||
          (hasAnyFamily(fam, ["pink", "orange", "yellow", "cyan", "hotPink"]) && f.meanC > 0.36);
        const cottageMud =
          f.meanC < 0.36 &&
          f.hueSpread < 68 &&
          (hasAnyFamily(fam, ["sage", "brown", "green"]) || f.neutralCount >= 4);
        if (cottageMud) return 0.48;
        if (!upbeat && f.meanL > 0.72) return 0.55;
        if (
          f.hueSpread < 55 &&
          hasAnyFamily(fam, ["green", "yellow"]) &&
          !hasAnyFamily(fam, ["pink", "orange", "cyan", "blue", "purple", "hotPink"])
        )
          return 0.52;
        if (f.neonCount >= 3 && f.deepCount >= 2) return 0.5;
        return 1;
      }
      case "wedding": {
        const b = hasAnyFamily(fam, ["ivory", "cream", "pink", "rose", "gold", "sage", "white"]);
        if (!b) return 0.58;
        if (f.contrast > 0.72 && !f.hasIvory && !f.hasCream) return 0.64;
        return 1;
      }
      case "tech": {
        const coolCore =
          hasAnyFamily(fam, ["blue", "navy", "cyan", "purple"]) ||
          (hasAnyFamily(fam, ["teal"]) && f.warmCool < 0.06);
        if (!coolCore) return 0.52;
        if (
          hasAnyFamily(fam, ["brown", "orange", "gold"]) &&
          f.warmCool > -0.06 &&
          !(f.neonCount >= 1 || f.meanC > 0.46)
        )
          return 0.48;
        if (f.pastelCount >= 4 && f.neonCount < 1 && hasAnyFamily(fam, ["pink"]) && f.meanC < 0.36) return 0.38;
        if (f.pastelCount >= 3 && f.neonCount < 1 && f.meanC < 0.34 && hasAnyFamily(fam, ["pink", "purple"]))
          return 0.44;
        if (
          f.hueSpread > 108 &&
          hasAnyFamily(fam, ["pink", "hotPink", "red"]) &&
          hasAnyFamily(fam, ["purple"]) &&
          !hasAnyFamily(fam, ["cyan", "teal"]) &&
          f.neonCount < 1
        )
          return 0.42;
        return 1;
      }
      case "dawn": {
        const coolOnly =
          hasAnyFamily(fam, ["blue", "cyan", "teal", "navy"]) &&
          !hasAnyFamily(fam, ["pink", "orange", "yellow", "purple", "cream", "ivory"]);
        if (coolOnly) return 0.42;
        if (!dawnHasSkyline(fam, f)) {
          if (f.meanL < 0.73 || hasAnyFamily(fam, ["brown"])) return 0.52;
          if (f.neutralCount >= 4 && f.meanL < 0.84) return 0.55;
        }
        if (f.neonCount >= 2 && f.contrast > 0.48) return 0.54;
        if (hasAnyFamily(fam, ["brown"]) && !hasAnyFamily(fam, ["pink", "purple"]) && f.meanL < 0.8) return 0.58;
        return 1;
      }
      default:
        return 1;
    }
  }

  function moodBonusV2(moodId, f, swatches, m, tags) {
    const fam = familySet(swatches);
    let b = 0;
    switch (moodId) {
      case "urgent":
        if (f.neonCount >= 1) b += 0.06;
        if (f.vividCount >= 2) b += 0.05;
        if (f.hasBlack && hasAnyFamily(fam, ["red", "orange", "yellow"])) b += 0.06;
        if (f.contrast > 0.78) b += 0.05;
        break;
      case "energy":
        if (f.neonCount >= 1) b += 0.08;
        if (f.vividCount >= 3) b += 0.07;
        if (f.contrast > 0.6) b += 0.05;
        if (f.meanC > 0.54) b += 0.05;
        if (f.hueEntropy > 0.52 && f.meanC > 0.48) b += 0.04;
        break;
      case "calm":
        if (f.hueSpread < 70) b += 0.05;
        if (f.meanC < 0.32) b += 0.04;
        if (f.contrast < 0.35) b += 0.04;
        if (hasAnyFamily(fam, ["blue", "teal", "sage"])) b += 0.05;
        break;
      case "lux":
        if (f.hasDarkAnchor) b += 0.05;
        if (f.hasCream || f.hasIvory) b += 0.04;
        if (hasAnyFamily(fam, ["gold", "purple", "green", "red"])) b += 0.05;
        if (f.hueEntropy < 0.48) b += 0.04;
        if (f.neutralCount >= 2) b += 0.03;
        break;
      case "clinical": {
        const cb = clinicalWhiteBlueDominance(swatches, f);
        if (f.hasPureWhite && cb.hasClearBlue) b += 0.08;
        else if (f.hasPureWhite) b += 0.04;
        if (cb.hasWhiteKey && cb.blueLeadRatio > 0.52) b += 0.07;
        if (cb.maxClearBlueChroma > 0.062) b += 0.06;
        else if (cb.maxClearBlueChroma > 0.048) b += 0.04;
        if (cb.storyDominatesAccents && cb.attributeChromW > 0.04) b += 0.03;
        if (hasAnyFamily(fam, ["green", "sage", "moss"])) b += 0.025;
        if (f.hasBlack || f.hasDarkAnchor) b += 0.02;
        if (cb.redAccentCount === 1 && cb.redAccentW < Math.max(cb.clearBlueW * 0.45, 0.06)) b += 0.015;
        if (f.warmCool < -0.38) b += 0.04;
        if (f.contrast >= 0.32 && f.contrast <= 0.68) b += 0.03;
        if (hasAnyFamily(fam, ["cyan", "blue", "navy"])) b += 0.05;
        else if (hasAnyFamily(fam, ["teal"])) b += 0.025;
        if ((m.blueTrust || 0) + (m.cyanClinical || 0) > 0.32) b += 0.04;
        break;
      }
      case "earth":
        if (hasAnyFamily(fam, ["brown", "orange", "yellow", "green", "sage"])) b += 0.07;
        if (f.meanC < 0.48) b += 0.04;
        if (f.warmCool > 0.15) b += 0.03;
        break;
      case "festival":
        if (f.vividCount >= 4) b += 0.08;
        if (f.hueEntropy > 0.68) b += 0.06;
        if (f.contrast > 0.65) b += 0.04;
        break;
      case "joy":
        if (f.hueEntropy > 0.55) b += 0.05;
        if (hasAnyFamily(fam, ["yellow", "orange", "pink"]) && f.meanL > 0.54) b += 0.05;
        if (f.vividCount >= 3) b += 0.05;
        if (hasAnyFamily(fam, ["cyan", "blue"]) && hasAnyFamily(fam, ["orange", "yellow", "pink"])) b += 0.04;
        break;
      case "pure":
        if (f.neutralCount >= 5) b += 0.1;
        if (f.hueEntropy < 0.2) b += 0.06;
        if (f.meanC < 0.12) b += 0.05;
        break;
      case "dawn":
        if (dawnHasSkyline(fam, f) && f.meanL > 0.72) b += 0.06;
        if (hasAnyFamily(fam, ["pink", "purple"]) && (f.hasCream || f.hasIvory || f.lightBaseRatio > 0.35)) b += 0.05;
        if (f.meanC < 0.34 && f.contrast < 0.52 && f.meanL > 0.74) b += 0.04;
        break;
      case "tech":
        if (f.neonCount >= 1) b += 0.06;
        if (hasAnyFamily(fam, ["cyan", "blue", "navy"]) && f.contrast > 0.48) b += 0.05;
        if (f.warmCool < -0.18 && hasAnyFamily(fam, ["purple", "teal"])) b += 0.04;
        break;
      default:
        break;
    }
    return b;
  }

  function moodPenaltyV2(moodId, f, swatches, m, tags) {
    const fam = familySet(swatches);
    let p = 0;
    switch (moodId) {
      case "urgent":
        if (f.meanC < 0.42) p += 0.12;
        if (f.contrast < 0.5) p += 0.14;
        if (!hasAnyFamily(fam, ["red", "orange", "yellow", "hotPink"]) && f.neonCount === 0) p += 0.18;
        break;
      case "energy":
        if (f.meanC < 0.44 && f.neonCount < 1) p += 0.14;
        if (f.contrast < 0.44 && f.neonCount < 1) p += 0.12;
        if (f.mutedCount >= 4 && f.vividCount < 2) p += 0.12;
        if (f.pastelCount >= 4 && f.neonCount < 1 && f.meanC < 0.46) p += 0.1;
        break;
      case "calm":
        if (f.neonCount > 0) p += 0.14;
        if (f.contrast > 0.62) p += 0.12;
        if (hasAnyFamily(fam, ["red", "hotPink", "orange"]) && f.meanC > 0.35) p += 0.12;
        if (f.vividCount >= 3) p += 0.1;
        break;
      case "lux":
        if (f.hueEntropy > 0.72 && f.vividCount >= 3) p += 0.16;
        if (f.neonCount >= 2) p += 0.14;
        if (!f.hasDarkAnchor && !f.hasCream && !f.hasIvory) p += 0.08;
        break;
      case "clinical": {
        const cb = clinicalWhiteBlueDominance(swatches, f);
        if (!cb.hasWhiteKey) p += 0.12;
        if (!cb.hasClearBlue) p += 0.16;
        if (cb.chromW > 0.06 && cb.blueLeadRatio < 0.34) p += 0.14;
        if (!cb.storyDominatesAccents && cb.attributeChromW > 0.18) p += 0.1;
        if (cb.warmAccentW > cb.clearBlueW * 1.15 && cb.warmAccentW > 0.13) p += 0.1;
        if (cb.greenCompeteW > cb.clearBlueW * 1.4 && cb.greenCompeteW > 0.12) p += 0.08;
        if (cb.redAccentCount > 1 && cb.redAccentW > cb.clearBlueW * 0.78) p += 0.1;
        if (hasAnyFamily(fam, ["brown", "orange", "yellow"]) && f.meanC > 0.2) p += 0.09;
        if (f.meanL < 0.45) p += 0.08;
        if (f.warmCool > 0.3) p += 0.1;
        if (
          !hasAnyFamily(fam, ["blue", "cyan", "teal", "navy"]) &&
          (m.blueTrust || 0) + (m.cyanClinical || 0) + (m.tealOcean || 0) * 0.85 < 0.12
        )
          p += 0.12;
        if (hasAnyFamily(fam, ["pink", "hotPink", "purple"]) && cb.blueLeadRatio < 0.44) p += 0.11;
        break;
      }
      case "pure":
        if (f.vividCount >= 2) p += 0.15;
        if (f.hueEntropy > 0.52) p += 0.14;
        if (f.neutralCount < 3) p += 0.14;
        else if (f.neutralCount === 3) p += 0.05;
        break;
      case "joy":
        if (f.meanC < 0.35 && f.hueSpread < 72) p += 0.12;
        if (hasAnyFamily(fam, ["brown", "moss"]) && f.neonCount >= 2) p += 0.14;
        if (f.neutralCount >= 5 && f.meanC < 0.3) p += 0.12;
        if (f.hueSpread < 58 && hasAnyFamily(fam, ["green", "yellow"]) && !hasAnyFamily(fam, ["pink", "cyan", "blue"]))
          p += 0.1;
        break;
      case "wedding":
        if (f.neonCount > 0) p += 0.16;
        if (f.contrast > 0.78 && !f.hasIvory && !f.hasCream) p += 0.12;
        break;
      case "dawn":
        if (!dawnHasSkyline(fam, f)) p += 0.14;
        if (hasAnyFamily(fam, ["blue", "navy", "teal", "cyan"]) && !hasAnyFamily(fam, ["pink", "purple"])) p += 0.12;
        if (hasAnyFamily(fam, ["brown"]) && !hasAnyFamily(fam, ["pink", "purple"])) p += 0.12;
        if (f.neonCount >= 1) p += 0.1;
        if (hasAnyFamily(fam, ["gold"]) && !hasAnyFamily(fam, ["pink", "purple"]) && f.meanC > 0.28) p += 0.08;
        break;
      case "tech":
        if (hasAnyFamily(fam, ["brown", "orange", "gold"]) && f.warmCool > -0.12) p += 0.14;
        if (f.pastelCount >= 3 && f.neonCount < 1 && f.meanC < 0.34) p += 0.11;
        if (f.pastelCount >= 4 && tags.pastel > 0.36 && f.neonCount < 1) p += 0.16;
        if (hasAnyFamily(fam, ["pink", "hotPink", "red"]) && f.hueSpread > 100 && !hasAnyFamily(fam, ["cyan", "teal"]))
          p += 0.14;
        if (
          hasAnyFamily(fam, ["pink", "hotPink"]) &&
          hasAnyFamily(fam, ["purple"]) &&
          !hasAnyFamily(fam, ["cyan", "teal"]) &&
          f.neonCount < 1
        )
          p += 0.12;
        if (f.warmCool > 0.22 && !hasAnyFamily(fam, ["purple", "hotPink"])) p += 0.1;
        break;
      default:
        break;
    }
    return p;
  }

  const MOOD_GUIDE_RULES = {
    calm: { prefer: ["blue", "cyan", "teal", "sage", "green", "white", "ivory", "cream", "grey"], avoid: ["red", "orange", "hotPink"], light: [0.62, 0.97], contrast: [0.08, 0.5], maxMeanC: 0.46, maxEntropy: 0.64 },
    trust: { prefer: ["navy", "blue", "teal", "cyan", "grey", "white"], avoid: ["brown", "orange", "hotPink"], light: [0.36, 0.9], contrast: [0.26, 0.78] },
    energy: { prefer: ["red", "orange", "yellow", "blue", "cyan", "hotPink", "purple"], avoid: ["brown", "sage", "moss"], light: [0.32, 0.9], contrast: [0.4, 1], minMeanC: 0.42, minEntropy: 0.4 },
    play: { prefer: ["pink", "hotPink", "yellow", "cyan", "blue", "purple", "orange"], avoid: ["brown"], light: [0.5, 0.98], contrast: [0.2, 0.72], minEntropy: 0.34 },
    lux: { prefer: ["black", "navy", "green", "purple", "gold", "ivory", "cream", "brown"], avoid: ["cyan", "hotPink", "yellow"], light: [0.12, 0.8], contrast: [0.36, 0.92] },
    earth: { prefer: ["green", "sage", "moss", "brown", "orange", "yellow", "cream", "ivory"], avoid: ["cyan", "hotPink"], light: [0.24, 0.82], contrast: [0.12, 0.62] },
    melancholy: { prefer: ["blue", "navy", "teal", "purple", "grey", "pink"], avoid: ["yellow", "orange"], light: [0.16, 0.68], contrast: [0.08, 0.5], maxMeanC: 0.42 },
    joy: { prefer: ["yellow", "orange", "pink", "cyan", "teal", "green", "blue"], avoid: ["brown", "black"], light: [0.5, 0.98], contrast: [0.18, 0.74], minEntropy: 0.34 },
    romance: { prefer: ["pink", "hotPink", "purple", "red", "ivory", "cream", "gold", "sage"], avoid: ["cyan", "teal", "green"], light: [0.48, 0.98], contrast: [0.08, 0.6] },
    clinical: { prefer: ["white", "ivory", "grey", "black", "blue", "cyan", "teal", "navy", "green", "sage", "moss"], avoid: ["brown", "orange", "yellow", "hotPink"], light: [0.5, 0.99], contrast: [0.2, 0.76], maxMeanC: 0.42 },
    tech: { prefer: ["blue", "cyan", "navy", "purple", "teal", "black", "grey", "white"], avoid: ["brown", "orange", "sage"], light: [0.18, 0.9], contrast: [0.26, 0.94], minMeanC: 0.24 },
    cozy: { prefer: ["brown", "orange", "yellow", "red", "pink", "cream", "ivory", "sage"], avoid: ["cyan", "teal"], light: [0.32, 0.9], contrast: [0.08, 0.54] },
    crisp: { prefer: ["white", "grey", "blue", "cyan", "teal", "navy"], avoid: ["brown", "orange", "red"], light: [0.66, 0.99], contrast: [0.16, 0.62], maxMeanC: 0.32 },
    noir: { prefer: ["black", "grey", "navy", "red", "gold", "green", "purple"], avoid: ["yellow", "pink", "cyan"], light: [0.06, 0.5], contrast: [0.42, 1] },
    nostalgia: { prefer: ["yellow", "orange", "red", "brown", "green", "blue", "cream"], avoid: ["cyan", "hotPink"], light: [0.3, 0.86], contrast: [0.12, 0.62], maxMeanC: 0.56 },
    pure: { prefer: ["white", "ivory", "cream", "grey", "black", "blue", "sage", "navy"], avoid: ["hotPink", "orange", "yellow"], light: [0.22, 0.99], contrast: [0.24, 0.86], maxEntropy: 0.44 },
    urgent: { prefer: ["red", "orange", "yellow", "hotPink", "black", "white"], avoid: ["sage", "moss", "brown"], light: [0.34, 0.96], contrast: [0.54, 1], minMeanC: 0.58, minEntropy: 0.32 },
    ocean: { prefer: ["cyan", "teal", "blue", "navy", "green", "white", "cream"], avoid: ["red", "brown"], light: [0.36, 0.96], contrast: [0.18, 0.74] },
    forest: { prefer: ["green", "moss", "sage", "teal", "brown", "yellow", "cream"], avoid: ["cyan", "hotPink"], light: [0.14, 0.74], contrast: [0.16, 0.66] },
    midnight: { prefer: ["navy", "blue", "purple", "black", "grey", "cyan"], avoid: ["yellow", "orange", "pink"], light: [0.05, 0.48], contrast: [0.3, 0.9] },
    dawn: { prefer: ["orange", "yellow", "pink", "purple", "blue", "sage", "cream", "ivory"], avoid: ["black", "red"], light: [0.64, 0.99], contrast: [0.08, 0.52] },
    festival: { prefer: ["hotPink", "purple", "cyan", "yellow", "orange", "green", "red"], avoid: ["brown", "sage", "moss"], light: [0.34, 0.95], contrast: [0.46, 1], minMeanC: 0.56, minEntropy: 0.52 },
    wedding: { prefer: ["ivory", "cream", "white", "pink", "sage", "gold", "purple", "red"], avoid: ["cyan", "hotPink"], light: [0.66, 0.99], contrast: [0.08, 0.54] },
    artisan: { prefer: ["brown", "orange", "yellow", "green", "blue", "cream", "sage"], avoid: ["cyan", "hotPink"], light: [0.24, 0.86], contrast: [0.14, 0.66] },
  };

  function moodFamilyMass(swatches, familyList) {
    if (!familyList || !familyList.length) return 0;
    const fam = new Set(familyList);
    let num = 0;
    let den = 0;
    for (const s of swatches) {
      const w = Math.max(0.1, s.roleWeight) * (s.isNeutral ? 0.42 : 0.45 + 0.55 * s.cNorm);
      den += w;
      if (fam.has(s.family)) num += w;
    }
    return den > 0 ? clamp01(num / den) : 0;
  }

  function moodGuideAlignment(moodId, f, swatches) {
    const r = MOOD_GUIDE_RULES[moodId];
    if (!r) return 0.5;
    const pref = moodFamilyMass(swatches, r.prefer || []);
    const avoid = moodFamilyMass(swatches, r.avoid || []);
    let s = 0.56 + 0.34 * pref - 0.42 * avoid;
    if (r.light) s *= bandSoft(f.meanL, r.light[0], r.light[1], 0.14);
    if (r.contrast) s *= bandSoft(f.contrast, r.contrast[0], r.contrast[1], 0.14);
    if (typeof r.maxMeanC === "number" && f.meanC > r.maxMeanC) s *= 0.86;
    if (typeof r.minMeanC === "number" && f.meanC < r.minMeanC) s *= 0.84;
    if (typeof r.maxEntropy === "number" && f.hueEntropy > r.maxEntropy) s *= 0.86;
    if (typeof r.minEntropy === "number" && f.hueEntropy < r.minEntropy) s *= 0.86;
    return clamp01(s);
  }

  function scoreMoodDirectional(palette, moodId, lemmas, summary) {
    const profile = MOOD_PROFILES_V2[moodId];
    if (!profile || !palette.features) return 0;
    const f = palette.features;
    const { swatches, harmony, tagSignals } = palette;
    const tags = palette.tags;
    const m = palette.m || {};
    const W = profile.weights || normWeights({});
    const soft = BAND_SOFT[moodId] || BAND_SOFT.default;

    const hueScore = hueFitV2(profile, swatches);
    const avoidM = avoidHueMult(profile, swatches);
    const satScore = bandSoft(f.meanC, profile.sat[0], profile.sat[1], soft.sat);
    const contrastScore = bandSoft(f.contrast, profile.contrast[0], profile.contrast[1], soft.contrast);
    const lightScore = bandSoft(f.meanL, profile.light[0], profile.light[1], soft.light);
    const tempScore = 1 - Math.min(1, Math.abs(f.warmCool - profile.temp) / 1.45);
    const harmonyScore = harmonyFit(profile, harmony, tags);
    const tagScore = tagFitV2(profile, tagSignals);
    const idScore = identityScoreFn(moodId, f, swatches, m);
    const gate = identityGateFn(moodId, f, swatches, m);

    let score =
      W.identity * idScore +
      W.hue * hueScore +
      W.saturation * satScore +
      W.contrast * contrastScore +
      W.lightness * lightScore +
      W.temperature * tempScore +
      W.harmony * harmonyScore +
      W.tags * tagScore;

    score += moodBonusV2(moodId, f, swatches, m, tags);
    score -= moodPenaltyV2(moodId, f, swatches, m, tags);

    const guideAlign = moodGuideAlignment(moodId, f, swatches);
    score += 0.14 * (guideAlign - 0.5);

    const sl = (summary || "").toLowerCase();
    let tb = 0;
    for (const lem of lemmas || []) {
      if (lem && sl.includes(lem)) tb += 0.08;
    }
    tb = Math.min(0.24, tb);
    const textBoost = (typeof global.W_TEXT === "number" ? global.W_TEXT : 0.025) * (tb / 0.24);
    score += textBoost;

    const chip = global.MOOD_CHIPS && global.MOOD_CHIPS.find((x) => x.id === moodId);
    let axisPart = 0;
    if (chip && global.AXIS_KEYS) {
      for (const k of global.AXIS_KEYS) {
        const pq = chip.axes[k];
        const pp = palette[k];
        axisPart += k === "warmCool" ? 1 - Math.min(1, Math.abs(pq - pp) / 2) : 1 - Math.min(1, Math.abs(pq - pp));
      }
      axisPart /= global.AXIS_KEYS.length;
    }
    const wAx = typeof global.W_AXIS === "number" ? global.W_AXIS : 0.08;
    score += wAx * axisPart;

    score *= avoidM;
    score *= gate;
    const out = clamp01(score);
    return Number.isFinite(out) ? out : 0;
  }

  global.buildPaletteMoodFeatures = buildPaletteMoodFeatures;
  global.scoreMoodDirectional = scoreMoodDirectional;
})(typeof window !== "undefined" ? window : globalThis);
