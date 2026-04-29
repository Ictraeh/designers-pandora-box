#!/usr/bin/env node
/**
 * Strip redundant `rgb` from each swatch (hex is enough for the demo).
 * Run from repo root: node "Mood to Color/demo/scripts/compact-pinterest-data.mjs"
 * Reads demo/data/pinterest-colors.json (or first arg), overwrites in place unless --out FILE.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultIn = path.join(__dirname, "..", "data", "pinterest-colors.json");
const argv = process.argv.slice(2);
let outPath = defaultIn;
let inPath = defaultIn;
if (argv[0] && !argv[0].startsWith("--")) inPath = path.resolve(argv[0]);
const outIdx = argv.indexOf("--out");
if (outIdx !== -1 && argv[outIdx + 1]) outPath = path.resolve(argv[outIdx + 1]);

const raw = fs.readFileSync(inPath, "utf8");
const j = JSON.parse(raw);
let stripped = 0;
for (const e of j.palettes_by_image || []) {
  for (const c of e.colors || []) {
    if ("rgb" in c) {
      delete c.rgb;
      stripped++;
    }
  }
}
const out = JSON.stringify(j);
fs.writeFileSync(outPath, out);
const before = Buffer.byteLength(raw, "utf8");
const after = Buffer.byteLength(out, "utf8");
console.log(`Wrote ${outPath} — ${before} → ${after} bytes (${stripped} rgb fields removed)`);
