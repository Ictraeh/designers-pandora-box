#!/usr/bin/env node
/**
 * Batch-score every palette in mindful-palettes.json + pinterest-colors.json for each mood chip,
 * using the same pipeline as the browser demo (mood-config + mood-engine-v2 + palette-analyze).
 *
 * Output: demo/data/mood-palette-precomputed.json
 *   — per mood: maxScore + top N entries with raw score and matchPct (0–100 vs that max).
 *
 * Run from repo root:
 *   node "Mood to Color/scripts/build-mood-palette-precompute.mjs"
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moodRoot = path.join(__dirname, "..");
const demoDir = path.join(moodRoot, "demo");
const themeDemoDir = path.join(moodRoot, "website-theme-demo");
const OUT_SCHEMA = 22;
const TOP_N = 250;

const ctx = vm.createContext({ window: {}, console });
for (const file of ["mood-config.js", "mood-engine-v2.js", "palette-analyze.js"]) {
  const src = fs.readFileSync(path.join(themeDemoDir, file), "utf8");
  vm.runInContext(src, ctx);
}

const MTP = ctx.window.MoodThemePalette;
const scoreMoodDirectional = ctx.window.scoreMoodDirectional;
const chips = ctx.window.MOOD_CHIPS;
if (!MTP || typeof scoreMoodDirectional !== "function" || !Array.isArray(chips)) {
  console.error("Failed to load mood engine / palette layer.");
  process.exit(1);
}

const mindful = JSON.parse(fs.readFileSync(path.join(demoDir, "data", "mindful-palettes.json"), "utf8"));
const pinterest = JSON.parse(fs.readFileSync(path.join(demoDir, "data", "pinterest-colors.json"), "utf8"));
let supplement = null;
try {
  const supPath = path.join(demoDir, "data", "palette-pool-supplement.json");
  if (fs.existsSync(supPath)) supplement = JSON.parse(fs.readFileSync(supPath, "utf8"));
} catch {
  supplement = null;
}
const list = MTP.buildUnifiedPaletteList(mindful, pinterest, supplement);

function paletteStableKey(p) {
  return `${MTP.paletteSource(p)}:${p.paletteNumber}`;
}

const out = {
  schema: OUT_SCHEMA,
  generatedAt: new Date().toISOString(),
  paletteCount: list.length,
  moods: {},
};

for (const chip of chips) {
  const moodId = chip.id;
  const lemmas = chip.lemmas || [];
  let maxScore = 0;
  const scored = [];
  let skippedIntra = 0;
  let skippedBad = 0;
  for (const p of list) {
    const hexes = (p.colors || []).map((c) => MTP.normalizeHex(c.hex)).filter(Boolean);
    if (hexes.length < 4) {
      skippedBad++;
      continue;
    }
    if (MTP.intraPaletteUnusableForWeb(hexes)) {
      skippedIntra++;
      continue;
    }
    const pal = MTP.analyzePalette(hexes);
    if (!pal) {
      skippedBad++;
      continue;
    }
    const summary = (p.paletteSummary || "").toLowerCase();
    const s = scoreMoodDirectional(pal, moodId, lemmas, summary);
    if (s > maxScore) maxScore = s;
    scored.push({ k: paletteStableKey(p), s });
  }
  scored.sort((a, b) => b.s - a.s);
  const top = scored.slice(0, TOP_N).map((x) => ({
    k: x.k,
    s: Math.round(x.s * 10000) / 10000,
    matchPct: maxScore > 1e-9 ? Math.min(100, Math.round((x.s / maxScore) * 100)) : 0,
  }));
  out.moods[moodId] = {
    maxScore: Math.round(maxScore * 10000) / 10000,
    scoredCount: scored.length,
    skippedIntra,
    skippedBad,
    top,
  };
  console.error(`${moodId}: max=${out.moods[moodId].maxScore} ranked=${scored.length} intra=${skippedIntra}`);
}

const outPath = path.join(demoDir, "data", "mood-palette-precomputed.json");
fs.writeFileSync(outPath, JSON.stringify(out));
console.error(`Wrote ${outPath}`);
