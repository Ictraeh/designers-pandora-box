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
    calm: { sat: 0.12, contrast: 0.12, light: 0.2 },
    lux: { sat: 0.2, contrast: 0.16, light: 0.22 },
    festival: { sat: 0.08, contrast: 0.14, light: 0.22 },
    pure: { sat: 0.07, contrast: 0.18, light: 0.26 },
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
    energy: mp([18, 35, 0, 205, 115, 330], [40, 90, 140], [0.58, 1], [0.42, 0.88], [0.48, 1], 0.25, ["complementary", "splitComplementary", "triadic"], ["bright", "neon", "sharp"], ["muted", "lowContrast", "pastelOnly"], {
      identity: 0.38,
      hue: 0.24,
      saturation: 0.16,
      contrast: 0.14,
      lightness: 0.04,
      temperature: 0.04,
      harmony: 0.06,
      tags: 0.1,
    }),
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
    joy: mp([55, 35, 20, 175, 120], [230, 260, 0], [0.45, 0.9], [0.58, 0.95], [0.28, 0.75], 0.35, ["triadic", "splitComplementary"], ["bright", "sunny", "airy"], ["darkHeavy", "muddy", "muted"]),
    romance: mp([345, 335, 0, 320, 275, 25], [110, 185, 205], [0.18, 0.62], [0.46, 0.9], [0.12, 0.55], 0.28, ["analogous"], ["soft", "pastel", "muted"], ["clinical", "neon", "sharp"]),
    clinical: mp([205, 190, 165, 215], [25, 35, 45, 330], [0.04, 0.38], [0.68, 0.98], [0.25, 0.68], -0.55, ["mono", "analogous"], ["clean", "airy", "sharp"], ["muddy", "earthy", "warm"]),
    tech: mp([205, 195, 220, 270, 145], [25, 35, 45], [0.34, 0.9], [0.18, 0.88], [0.42, 0.92], -0.35, ["mono", "analogous"], ["neon", "sharp", "cool"], ["muddy", "earthy", "warm"]),
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
    dawn: mp([25, 40, 55, 270, 205, 330], [0, 225], [0.12, 0.52], [0.62, 0.96], [0.08, 0.42], 0.22, ["analogous"], ["pastel", "airy", "soft"], ["darkHeavy", "neon", "sharp"]),
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
      case "calm":
        return clamp01(0.65 * coolMass + 0.2 * (1 - f.contrast) + 0.15 * (1 - f.meanC * 2));
      case "trust":
        return clamp01((m.blueTrust + m.tealOcean * 0.8) / 1.8 + 0.2 * f.contrast);
      case "lux":
        return clamp01(0.45 * (f.hasDarkAnchor || f.hasIvory || f.hasCream ? 1 : 0.55) + 0.35 * (1 - f.hueEntropy) + 0.2 * (m.deepShadow * 0.5 + m.goldChampagne * 0.4));
      case "clinical":
        return clamp01(0.5 * (f.hasPureWhite || f.lightBaseRatio > 0.45 ? 1 : 0.45) + 0.35 * (1 - f.warmCool) * 0.5 + 0.15 * f.contrast);
      case "festival":
        return clamp01(0.45 * f.hueEntropy + 0.35 * Math.min(1, f.vividCount * 0.22) + 0.2 * f.contrast);
      case "pure":
        return clamp01(0.55 * (f.neutralCount >= 4 ? 1 : 0.35) + 0.45 * (1 - f.hueEntropy));
      case "forest":
        return clamp01(hasAnyFamily(fam, ["green", "sage", "moss", "teal"]) ? 0.75 + f.meanC * 0.25 : 0.25);
      case "ocean":
        return clamp01(hasAnyFamily(fam, ["blue", "navy", "teal", "cyan"]) ? 0.82 : 0.28);
      case "wedding":
        return clamp01(
          (hasAnyFamily(fam, ["ivory", "cream", "pink", "rose", "gold", "sage", "white"]) ? 0.72 : 0.3) + 0.28 * (1 - f.contrast * 0.4),
        );
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
        const clean = f.hasPureWhite || f.lightBaseRatio > 0.45;
        const cool = f.warmCool < -0.2;
        if (!clean) return 0.62;
        if (!cool && f.warmCool > 0.35) return 0.58;
        return 1;
      }
      case "festival": {
        if (f.hueEntropy < 0.5 || f.vividCount < 3) return 0.55;
        return 1;
      }
      case "pure": {
        if (f.neutralCount < 4) return 0.45;
        if (f.hueEntropy > 0.35) return 0.55;
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
      case "wedding": {
        const b = hasAnyFamily(fam, ["ivory", "cream", "pink", "rose", "gold", "sage", "white"]);
        if (!b) return 0.58;
        if (f.contrast > 0.72 && !f.hasIvory && !f.hasCream) return 0.64;
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
      case "clinical":
        if (f.hasPureWhite) b += 0.06;
        if (f.warmCool < -0.35) b += 0.04;
        if (f.contrast >= 0.35 && f.contrast <= 0.68) b += 0.03;
        if (hasAnyFamily(fam, ["cyan", "blue"])) b += 0.04;
        break;
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
      case "pure":
        if (f.neutralCount >= 5) b += 0.1;
        if (f.hueEntropy < 0.2) b += 0.06;
        if (f.meanC < 0.12) b += 0.05;
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
      case "clinical":
        if (hasAnyFamily(fam, ["brown", "orange", "yellow"]) && f.meanC > 0.2) p += 0.1;
        if (f.meanL < 0.45) p += 0.12;
        if (f.warmCool > 0.35) p += 0.1;
        break;
      case "pure":
        if (f.vividCount >= 2) p += 0.18;
        if (f.hueEntropy > 0.5) p += 0.16;
        if (f.neutralCount < 4) p += 0.15;
        break;
      case "wedding":
        if (f.neonCount > 0) p += 0.16;
        if (f.contrast > 0.78 && !f.hasIvory && !f.hasCream) p += 0.12;
        break;
      default:
        break;
    }
    return p;
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
