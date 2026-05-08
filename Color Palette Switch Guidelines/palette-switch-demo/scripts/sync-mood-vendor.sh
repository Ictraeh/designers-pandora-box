#!/usr/bin/env sh
# Copy Mood to Color engine + mindful palette data into ./vendor (run from monorepo root
# "Designer's pandora box" or set MOOD_ROOT to your Mood to Color clone).
set -e
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MOOD_ROOT="${MOOD_ROOT:-$REPO_ROOT/Mood to Color}"
DEMO="$REPO_ROOT/Color Palette Switch Guidelines/palette-switch-demo"
mkdir -p "$DEMO/vendor/mood-theme" "$DEMO/vendor/mood-data"
cp "$MOOD_ROOT/website-theme-demo/mood-config.js" \
  "$MOOD_ROOT/website-theme-demo/mood-engine-v2.js" \
  "$MOOD_ROOT/website-theme-demo/palette-analyze.js" \
  "$MOOD_ROOT/website-theme-demo/theme-pipeline.js" \
  "$DEMO/vendor/mood-theme/"
cp "$MOOD_ROOT/demo/data/mindful-palettes.json" "$DEMO/vendor/mood-data/"
echo "Updated $DEMO/vendor (mood theme JS + mindful-palettes.json)."
