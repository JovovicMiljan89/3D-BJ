// Accent color for the crno-bela theme: presets from scripts/data/akcenti.json
// or a custom hex, turned into CSS variables and recolored SVGs at build time.
// Pure functions only (no file writes), so they're easy to unit-test.
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRESETS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "akcenti.json");

export const CUSTOM_ACCENT = "prilagodjena";
export const DEFAULT_ACCENT = "narandzasta";
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const BLACK = "#0a0a0a";
const WHITE = "#ffffff";
// Below this contrast against the black page, an accent is hard to see.
export const MIN_ACCENT_CONTRAST = 3;

export function loadPresets() {
  return JSON.parse(fs.readFileSync(PRESETS_PATH, "utf-8")).akcenti;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) {
  return "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl([r, g, b]) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

// ~20% darker: lightness scaled by 0.8 in HSL, hue and saturation kept.
export function darken(hex, amount = 0.2) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h, s, l * (1 - amount)]));
}

// Mix toward white — used for the hero's light-red details (nozzle tip, filament line).
function lighten(hex, amount) {
  return rgbToHex(hexToRgb(hex).map((v) => v + (255 - v) * amount));
}

// Whichever of black / white reads better on the accent (WCAG contrast).
export function textOn(hex) {
  return contrastRatio(hex, BLACK) >= contrastRatio(hex, WHITE) ? BLACK : WHITE;
}

// { key, isCustom, accent, darker, onAccent, warnings[] }. Assumes the settings
// already passed validation (validate.mjs rejects a bad key or hex).
export function resolveAccent(themeSettings = {}, presets = loadPresets()) {
  const key = themeSettings.accent || DEFAULT_ACCENT;
  let resolved;
  if (key === CUSTOM_ACCENT) {
    const accent = themeSettings.customAccent.toLowerCase();
    resolved = { key, isCustom: true, accent, darker: darken(accent), onAccent: textOn(accent) };
  } else {
    const p = presets[key];
    resolved = { key, isCustom: false, accent: p.akcenat, darker: p.tamniji, onAccent: p.tekst_na_akcentu };
  }
  const ratio = contrastRatio(resolved.accent, BLACK);
  resolved.warnings =
    ratio < MIN_ACCENT_CONTRAST
      ? [
          `Boja akcenta ${resolved.accent} je previše tamna za crnu pozadinu (kontrast ${ratio.toFixed(2)}:1, preporuka najmanje ${MIN_ACCENT_CONTRAST}:1) — slabo će se videti. Izaberi svetliju boju.`,
        ]
      : [];
  return resolved;
}

function rgba(hex, alpha) {
  return `rgba(${hexToRgb(hex).join(", ")}, ${alpha})`;
}

// Inline <style> body. Same selector as the theme block in styles.css so it
// wins by source order (the inline style comes after the stylesheet link).
export function accentCss({ accent, darker, onAccent }) {
  return (
    `:root[data-theme="crnobela"] { ` +
    `--primary: ${accent}; --primary-dark: ${darker}; --primary-soft: ${rgba(accent, 0.13)}; ` +
    `--accent: ${accent}; --on-accent: ${onAccent}; --glow: ${rgba(accent, 0.1)}; }`
  );
}

// Same mapping the provided accent logos (assets/logo/accents/) were made with,
// plus the hero illustration's extra colors.
export function accentColorMap({ accent, darker }) {
  return {
    "#e11d2e": accent,
    "#b3121f": darker,
    "#1b2d55": "#262626",
    "#2f4f9a": "#5c5c5c",
    "#24365c": "#3a3a3a",
    "#070b14": "#0a0a0a",
    // hero-printer.svg only:
    "#0a1020": "#0a0a0a",
    "#ff8a94": lighten(accent, 0.45),
    "#8a93a8": "#8f8f8f",
  };
}

export function recolorSvg(svg, resolved) {
  const map = accentColorMap(resolved);
  return svg.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => map[hex.toLowerCase()] || hex);
}

// Which pre-rendered OG image (og-{bj|mdl}-{accent}.png) matches the brand name.
export function brandSlug(brandName) {
  const name = (brandName || "").toUpperCase();
  if (name.includes("MDL")) return "mdl";
  if (name.includes("BJ")) return "bj";
  return null;
}
