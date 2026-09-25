#!/usr/bin/env node
// Zero-dependency static site builder.
// content/site.json + src/index.template.html  -->  dist/
"use strict";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateContent } from "./lib/validate.mjs";
import { renderTemplate } from "./lib/render.mjs";
import { getImageSize } from "./lib/image-size.mjs";
import { bwPath } from "./lib/bw.mjs";
import { accentCss, brandSlug, recolorSvg, resolveAccent } from "./lib/theme.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
// BUILD_CONTENT / BUILD_DIST_DIR exist only so the e2e suite can build and
// serve theme variants side by side; production builds never set them.
const CONTENT_PATH = process.env.BUILD_CONTENT ? path.resolve(process.env.BUILD_CONTENT) : path.join(ROOT, "content", "site.json");
const TEMPLATE_PATH = path.join(ROOT, "src", "index.template.html");
const DIST_DIR = process.env.BUILD_DIST_DIR ? path.resolve(process.env.BUILD_DIST_DIR) : path.join(ROOT, "dist");
const CSS_PATH = path.join(ROOT, "css", "styles.css");

function fail(message) {
  console.error(`\n[build] FAILED: ${message}\n`);
  process.exit(1);
}

function loadContent() {
  if (!fs.existsSync(CONTENT_PATH)) {
    fail(`content/site.json not found at ${CONTENT_PATH}`);
  }
  const raw = fs.readFileSync(CONTENT_PATH, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`content/site.json is not valid JSON — ${err.message}`);
  }
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true });
}

// /admin is a shortcut to this repo's Pages CMS editor (the CMS has its own
// login — nothing on the site itself is password-protected).
const ADMIN_URL = "https://app.pagescms.org/JovovicMiljan89/3D-BJ/static-cms";

function buildRedirects() {
  return `/admin ${ADMIN_URL} 302
/admin/ ${ADMIN_URL} 302
/admin/* ${ADMIN_URL} 302
`;
}

function buildHeaders() {
  return `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=()

/css/*
  Cache-Control: public, max-age=31536000, immutable

/js/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=0, must-revalidate

/index.html
  Cache-Control: public, max-age=0, must-revalidate
`;
}

// Joins a base URL with an absolute path ("/assets/x.png") without
// double/missing slashes. Assumes seo.siteUrl already ends with "/".
function absoluteUrl(siteUrl, absPath) {
  const base = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
  const p = absPath.startsWith("/") ? absPath : `/${absPath}`;
  return base + p;
}

// Prevents a JSON-LD string value from being able to prematurely close the
// <script> tag it's embedded (raw, unescaped) into.
function scriptSafeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildLocalBusinessJsonLd(content) {
  const { brand, seo, contact } = content;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: brand.name,
    description: content.meta.description,
    url: seo.siteUrl,
    logo: absoluteUrl(seo.siteUrl, brand.logoFull),
    image: absoluteUrl(seo.siteUrl, seo.ogImage),
  };

  if (contact.phoneTel) jsonLd.telephone = contact.phoneTel;
  if (contact.email) jsonLd.email = contact.email;
  if (contact.city) {
    jsonLd.address = {
      "@type": "PostalAddress",
      addressLocality: contact.city,
      addressCountry: "RS",
    };
  }

  const sameAs = [contact.instagram, contact.facebook].filter(Boolean);
  if (sameAs.length) jsonLd.sameAs = sameAs;

  return jsonLd;
}

// Computes everything the template needs beyond what's literally in
// content/site.json: hiding empty/zero optional content, and the derived
// SEO fields (absolute URLs, JSON-LD). Keeping this here (rather than in the
// template engine) means the template only ever deals with plain
// {{value}} / {{#each}} / {{#if}} — no business logic in the markup.
// Resolves an /assets/... path to its real on-disk pixel dimensions, so
// <img width/height> always matches whatever photo is currently in place —
// including one an admin swapped in through the CMS — instead of numbers
// someone hand-typed into site.json that can silently go stale.
const FAVICON_TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

function resolveDims(root, absPath) {
  const source = GENERATED.get(absPath)?.source || absPath;
  const fsPath = path.join(root, source.replace(/^\//, ""));
  const size = getImageSize(fsPath);
  if (!size) {
    console.warn(`[build] WARNING: could not read image dimensions for ${absPath} — using a 1200x800 fallback.`);
    return { width: 1200, height: 800 };
  }
  return size;
}

// Optional sections are shown unless the admin explicitly switched them off.
function isSectionEnabled(section) {
  return section?.enabled !== false;
}

// <meta name="theme-color"> follows the active theme's --bg, read straight
// from the CSS so there's a single source of truth for the palette.
function themeBackground(theme) {
  const css = fs.readFileSync(CSS_PATH, "utf-8");
  const block = css.match(new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`));
  const bg = block && block[1].match(/--bg:\s*([^;]+);/);
  return bg ? bg[1].trim() : "#000000";
}

// SVGs recolored to the accent at build time: written to dist/ only, under a
// name that includes the color. Maps "/assets/theme/x-ff7a1a.svg" -> its
// source path, so resolveDims() can read the (identical) viewBox from the source.
const GENERATED = new Map(); // publicPath -> { source, content }

const exists = (publicPath) => fs.existsSync(path.join(ROOT, publicPath.replace(/^\//, "")));

function recolored(sourcePath, accent) {
  const { name } = path.parse(sourcePath);
  const publicPath = `/assets/theme/${name}-${accent.accent.slice(1)}.svg`;
  const svg = fs.readFileSync(path.join(ROOT, sourcePath.replace(/^\//, "")), "utf-8");
  GENERATED.set(publicPath, { source: sourcePath, content: recolorSvg(svg, accent) });
  return publicPath;
}

// Falls back to the neutral black & white (-bw) raster, then the original.
function bwOrOriginal(publicPath) {
  return exists(bwPath(publicPath)) ? bwPath(publicPath) : publicPath;
}

// Crno-bela + accent: which file each brand/hero/OG image field uses.
//  - SVGs (logo, mark, favicon, hero): recolored from the originals with the
//    same color map as the provided assets/logo/accents/ files (see theme.mjs).
//  - PNGs: preset -> the pre-rendered accent PNG; custom color -> neutral B&W.
function applyAccentImages(data, accent) {
  for (const [section, field] of [["brand", "logo"], ["brand", "mark"], ["brand", "favicon"], ["hero", "image"]]) {
    const src = data[section][field];
    data[section][field] = src.toLowerCase().endsWith(".svg") ? recolored(src, accent) : bwOrOriginal(src);
  }

  const presetIcon = `/assets/logo/accents/3d-icon-${accent.key}-512.png`;
  data.brand.appleIcon = !accent.isCustom && exists(presetIcon) ? presetIcon : bwOrOriginal(data.brand.appleIcon);

  const slug = brandSlug(data.brand.name);
  const presetOg = `/assets/og/accents/og-${slug}-${accent.key}.png`;
  data.seo.ogImage = !accent.isCustom && slug && exists(presetOg) ? presetOg : bwOrOriginal(data.seo.ogImage);

  data.brand.logoFull = bwOrOriginal(data.brand.logoFull);
}

function applyTheme(data) {
  const settings = data.theme || {};
  const base = settings.base || "crnobela";
  const view = {
    name: base,
    color: themeBackground(base),
    grayscalePhotos: base === "crnobela" && settings.grayscalePhotos !== false,
    highlightActiveSection: settings.highlightActiveSection !== false,
    accentCss: "",
  };
  if (base === "crnobela") {
    const accent = resolveAccent(settings);
    for (const w of accent.warnings) console.warn(`[build] WARNING: ${w}`);
    view.accent = accent.accent;
    view.accentCss = accentCss(accent);
    applyAccentImages(data, accent);
  }
  data.theme = view;
}

function computeViewModel(content, assets) {
  const data = structuredClone(content);
  data.assets = assets;
  applyTheme(data);

  data.business = { ...data.business, enabled: isSectionEnabled(data.business) };
  data.spareParts = { ...data.spareParts, enabled: isSectionEnabled(data.spareParts) };

  // --- Image dimensions, read from the actual files (see resolveDims above).
  // --- Brand: the name is edited once (brand.name) and composed into the
  // <title>/og:title here; logo widths follow the logo's real aspect ratio.
  data.meta = { ...data.meta, fullTitle: `${data.brand.name} | ${data.meta.title}` };
  const logoDims = resolveDims(ROOT, data.brand.logo);
  data.brand = {
    ...data.brand,
    logoHeaderWidth: Math.round((40 * logoDims.width) / logoDims.height),
    logoFooterWidth: Math.round((32 * logoDims.width) / logoDims.height),
    faviconType: FAVICON_TYPES[path.extname(data.brand.favicon).toLowerCase()] || "image/png",
  };

  const heroDims = resolveDims(ROOT, data.hero.image);
  data.hero.imageWidth = heroDims.width;
  data.hero.imageHeight = heroDims.height;

  const workshopDims = resolveDims(ROOT, data.workshop.photo);
  data.workshop.photoWidth = workshopDims.width;
  data.workshop.photoHeight = workshopDims.height;

  data.workshop.equipment = data.workshop.equipment.map((item) => ({
    ...item,
    ...resolveDims(ROOT, item.image),
  }));

  data.gallery = data.gallery.map((item) => ({
    ...item,
    ...resolveDims(ROOT, item.image),
  }));

  // --- Prices: hide any card with from <= 0; hide the whole section if none are left.
  const visibleItems = (data.prices?.items || []).filter((item) => typeof item.from === "number" && item.from > 0);
  data.prices = { ...data.prices, visibleItems, visible: visibleItems.length > 0 };

  // --- Viber/WhatsApp are stored as bare digits (for the links); show them
  // like the phone number when it's the same number, otherwise as +digits.
  const phoneDigits = (data.contact.phoneTel || "").replace(/\D/g, "");
  const displayNumber = (digits) => (digits && digits === phoneDigits ? data.contact.phoneDisplay : `+${digits}`);
  data.contact.viberDisplay = displayNumber(data.contact.viber);
  data.contact.whatsappDisplay = displayNumber(data.contact.whatsapp);

  // --- Footer/social: hide the whole "Društvene mreže" column when both links are empty.
  data.contact.hasSocial = Boolean(data.contact.instagram || data.contact.facebook);

  // --- Maker photo falls back to the logo mark if the admin hasn't uploaded one yet.
  data.maker = { ...data.maker, avatarResolved: data.maker.photo || data.brand.mark };

  // --- FAQ: first item open by default. The template engine can't compare
  // @index to a literal, so we precompute the flag here instead.
  data.faq = (data.faq || []).map((item, i) => ({ ...item, isFirst: i === 0 }));

  // --- SEO: absolute URLs + JSON-LD (computed, not admin-editable — safe to render raw).
  const ogImageAbsolute = absoluteUrl(data.seo.siteUrl, data.seo.ogImage);
  const ogDims = resolveDims(ROOT, data.seo.ogImage);
  data.seo = {
    ...data.seo,
    ogImageAbsolute,
    ogImageWidth: ogDims.width,
    ogImageHeight: ogDims.height,
    canonicalUrl: data.seo.siteUrl,
    jsonLd: scriptSafeJson(buildLocalBusinessJsonLd(data)),
  };

  data.build = { year: new Date().getFullYear() };

  return data;
}

// css/ and js/ are served with a one-year immutable cache (see _headers), so
// their file names must change whenever their content does. Copies
// <dir>/<name>.<ext> to dist/<dir>/<name>.<hash>.<ext> and returns the URL.
function copyHashed(relPath) {
  const src = path.join(ROOT, relPath);
  const buf = fs.readFileSync(src);
  const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
  const { dir, name, ext } = path.parse(relPath);
  const hashedRel = path.join(dir, `${name}.${hash}${ext}`);
  fs.mkdirSync(path.join(DIST_DIR, dir), { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, hashedRel), buf);
  return "/" + hashedRel.split(path.sep).join("/");
}

// Stock photos are marked `placeholder: true` in site.json until Bojan
// uploads his own; list them after every build so they don't get forgotten.
function listPlaceholders(content) {
  const found = [];
  (content.workshop?.equipment || []).forEach((item, i) => {
    if (item.placeholder === true) found.push(`workshop.equipment[${i}] "${item.title}" — ${item.image}`);
  });
  (content.gallery || []).forEach((item, i) => {
    if (item.placeholder === true) found.push(`gallery[${i}] "${item.caption}" — ${item.image}`);
  });
  return found;
}

function main() {
  const content = loadContent();

  const { valid, errors } = validateContent(content, ROOT);
  if (!valid) {
    console.error(`\n[build] content/site.json failed validation (${errors.length} problem${errors.length === 1 ? "" : "s"}):\n`);
    for (const err of errors) console.error(`  - ${err}`);
    console.error("\nFix content/site.json (or add the missing image file) and rebuild.\n");
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    fail(`Template not found at ${TEMPLATE_PATH}`);
  }
  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const assets = { css: copyHashed("css/styles.css"), js: copyHashed("js/main.js") };
  const data = computeViewModel(content, assets);
  const html = renderTemplate(template, data);

  fs.writeFileSync(path.join(DIST_DIR, "index.html"), html);
  copyDir(path.join(ROOT, "assets"), path.join(DIST_DIR, "assets"));
  for (const [publicPath, { content: svg }] of GENERATED) {
    const out = path.join(DIST_DIR, publicPath.replace(/^\//, ""));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, svg);
  }
  // reference/ (local-only UI/UX reference material) is never copied — dist/
  // only ever gets css/, js/, assets/ and the rendered index.html, above.
  fs.writeFileSync(path.join(DIST_DIR, "_headers"), buildHeaders());
  fs.writeFileSync(path.join(DIST_DIR, "_redirects"), buildRedirects());

  const placeholders = listPlaceholders(content);
  if (placeholders.length) {
    console.warn(`\n[build] WARNING: ${placeholders.length} image(s) are still temporary stock photos (placeholder: true) — replace with real photos:`);
    for (const line of placeholders) console.warn(`  - ${line}`);
    console.warn("");
  }

  console.log(`[build] OK — wrote ${path.relative(ROOT, DIST_DIR)}/ (index.html, ${assets.css}, ${assets.js}, assets/, _headers, _redirects)`);
}

main();
