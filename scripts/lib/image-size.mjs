// Zero-dependency image dimension reader (SVG viewBox, PNG IHDR, JPEG SOF, WebP).
// Used at build time so <img width/height> attributes always match whatever
// photo is currently in place — including a photo an admin swapped in
// through the CMS — instead of stale numbers hand-entered into site.json.
"use strict";

import fs from "node:fs";

function getSvgSize(absPath) {
  const content = fs.readFileSync(absPath, "utf-8");
  const viewBox = content.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/);
  if (viewBox) return { width: Math.round(parseFloat(viewBox[1])), height: Math.round(parseFloat(viewBox[2])) };
  const w = content.match(/<svg[^>]*\swidth=["']?([\d.]+)/);
  const h = content.match(/<svg[^>]*\sheight=["']?([\d.]+)/);
  if (w && h) return { width: Math.round(parseFloat(w[1])), height: Math.round(parseFloat(h[1])) };
  return null;
}

function getPngSize(absPath) {
  const buf = fs.readFileSync(absPath);
  if (buf.length < 24 || buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function getJpegSize(absPath) {
  const buf = fs.readFileSync(absPath);
  let offset = 2; // skip the SOI marker (0xFFD8)
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    // SOFn markers (0xC0-0xCF), excluding DHT/JPG/DAC which reuse that range.
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return null;
}

// RIFF....WEBP, then one of three chunk layouts: VP8 (lossy), VP8L
// (lossless) or VP8X (extended, e.g. with alpha/metadata).
function getWebpSize(absPath) {
  const buf = fs.readFileSync(absPath);
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  return null;
}

export function getImageSize(absPath) {
  const lower = absPath.toLowerCase();
  if (lower.endsWith(".svg")) return getSvgSize(absPath);
  if (lower.endsWith(".png")) return getPngSize(absPath);
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return getJpegSize(absPath);
  if (lower.endsWith(".webp")) return getWebpSize(absPath);
  return null;
}
