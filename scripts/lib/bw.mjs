// Black & white ("crnobela") variants of the brand SVGs.
// Pure string recoloring, so it's deterministic and dependency-free.
"use strict";

// Exact mapping from the navy/red palette to grays. The last two entries are
// bluish grays that only need neutralising (tagline + hero printer rails).
export const BW_COLOR_MAP = {
  "#e11d2e": "#ffffff", // red
  "#b3121f": "#d4d4d4", // dark red
  "#ff8a94": "#cfcfcf", // light red
  "#1b2d55": "#262626", // navy
  "#2f4f9a": "#5c5c5c", // navy light
  "#24365c": "#3a3a3a", // navy mid
  "#070b14": "#0a0a0a", // bg
  "#0a1020": "#0a0a0a", // bg
  "#e7ecf6": "#f2f2f2", // text
  "#8e9ab4": "#9a9a9a", // muted (tagline)
  "#8a93a8": "#8f8f8f", // gray (hero printer rails)
};

// The cube's nozzle dot sits on the (now white) top face — make it dark so it stays visible.
const CUBE_DOT = /(<circle cx="60" cy="34" r="5" fill=")#f2f2f2(")/g;

export function bwPath(assetPath) {
  return assetPath.replace(/(\.[a-z0-9]+)$/i, "-bw$1");
}

function isGray(hex) {
  const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) <= 8;
}

// Returns the recolored SVG; throws if a non-gray color isn't in the map,
// so no navy/red can silently survive in a B&W asset.
export function toBwSvg(svg) {
  const out = svg
    .replace(/#[0-9a-fA-F]{6}\b/g, (hex) => BW_COLOR_MAP[hex.toLowerCase()] || hex)
    .replace(CUBE_DOT, "$1#0a0a0a$2");
  const leftovers = [...new Set(out.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g) || [])].filter((c) => !isGray(c));
  if (leftovers.length) throw new Error(`Unmapped colors in SVG: ${leftovers.join(", ")}`);
  return out;
}
