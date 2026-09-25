#!/usr/bin/env node
// One-off generator for the crno-bela theme assets (run again if a source
// logo/illustration changes):   node scripts/make-bw-assets.mjs
//
// - SVGs: recolored with scripts/lib/bw.mjs, written next to the original as *-bw.svg
// - PNGs: rendered from the B&W SVGs (logoFull, apple-touch-icon) or, for the
//   OG image, converted to grayscale — via the Playwright Chromium that the
//   e2e suite already installs (tests/e2e), so the site itself stays dependency-free.
"use strict";

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { bwPath, toBwSvg } from "./lib/bw.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(path.join(ROOT, "tests", "e2e", "package.json"))("playwright");

const SVGS = [
  "assets/logo/3d-mdl-wordmark.svg",
  "assets/logo/3d-mdl-mark.svg",
  "assets/logo/3d-mdl-icon.svg",
  "assets/logo/3d-mdl-horizontal.svg",
  "assets/images/hero-printer.svg",
];
// [png to produce a -bw variant of, B&W svg to render it from]
const PNG_FROM_SVG = [
  ["assets/logo/3d-mdl-icon-512.png", "assets/logo/3d-mdl-icon-bw.svg"],
  ["assets/logo/3d-mdl-horizontal.png", "assets/logo/3d-mdl-horizontal-bw.svg"],
];
const PNG_GRAYSCALE = ["assets/og/og-image-mdl.png"];

const abs = (p) => path.join(ROOT, p);
const dataUrl = (p, type) => `data:${type};base64,${fs.readFileSync(abs(p)).toString("base64")}`;

for (const svg of SVGS) {
  fs.writeFileSync(abs(bwPath(svg)), toBwSvg(fs.readFileSync(abs(svg), "utf-8")));
  console.log("svg ", bwPath(svg));
}

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(src, width, height, { grayscale = false, background = null } = {}) {
  const b64 = await page.evaluate(
    async ({ src, width, height, grayscale, background }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = Object.assign(document.createElement("canvas"), { width, height });
      const ctx = canvas.getContext("2d");
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
      }
      if (grayscale) ctx.filter = "grayscale(1)";
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { src, width, height, grayscale, background }
  );
  return Buffer.from(b64, "base64");
}

const pngSize = (p) => {
  const buf = fs.readFileSync(abs(p));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), alpha: buf[25] === 6 || buf[25] === 4 };
};

for (const [png, svg] of PNG_FROM_SVG) {
  const { width, height, alpha } = pngSize(png);
  // Keep the original's transparency; opaque originals get the B&W page background.
  const out = await render(dataUrl(svg, "image/svg+xml"), width, height, { background: alpha ? null : "#0a0a0a" });
  fs.writeFileSync(abs(bwPath(png)), out);
  console.log("png ", bwPath(png), `${width}x${height}`);
}
for (const png of PNG_GRAYSCALE) {
  const { width, height } = pngSize(png);
  fs.writeFileSync(abs(bwPath(png)), await render(dataUrl(png, "image/png"), width, height, { grayscale: true }));
  console.log("png ", bwPath(png), `${width}x${height} (grayscale)`);
}
await browser.close();
