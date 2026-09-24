#!/usr/bin/env node
// Zero-dependency static site builder.
// content/site.json + src/index.template.html  -->  dist/
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateContent } from "./lib/validate.mjs";
import { renderTemplate } from "./lib/render.mjs";
import { getImageSize } from "./lib/image-size.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_PATH = path.join(ROOT, "content", "site.json");
const TEMPLATE_PATH = path.join(ROOT, "src", "index.template.html");
const DIST_DIR = path.join(ROOT, "dist");

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
  Cache-Control: public, max-age=31536000, immutable

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
function resolveDims(root, absPath) {
  const fsPath = path.join(root, absPath.replace(/^\//, ""));
  const size = getImageSize(fsPath);
  if (!size) {
    console.warn(`[build] WARNING: could not read image dimensions for ${absPath} — using a 1200x800 fallback.`);
    return { width: 1200, height: 800 };
  }
  return size;
}

function computeViewModel(content) {
  const data = structuredClone(content);

  // --- Image dimensions, read from the actual files (see resolveDims above).
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

  // --- Footer/social: hide the whole "Društvene mreže" column when both links are empty.
  data.contact.hasSocial = Boolean(data.contact.instagram || data.contact.facebook);

  // --- Maker photo falls back to the logo mark if the admin hasn't uploaded one yet.
  data.maker = { ...data.maker, avatarResolved: data.maker.photo || data.maker.avatar };

  // --- FAQ: first item open by default. The template engine can't compare
  // @index to a literal, so we precompute the flag here instead.
  data.faq = (data.faq || []).map((item, i) => ({ ...item, isFirst: i === 0 }));

  // --- SEO: absolute URLs + JSON-LD (computed, not admin-editable — safe to render raw).
  const ogImageAbsolute = absoluteUrl(data.seo.siteUrl, data.seo.ogImage);
  data.seo = {
    ...data.seo,
    ogImageAbsolute,
    canonicalUrl: data.seo.siteUrl,
    jsonLd: scriptSafeJson(buildLocalBusinessJsonLd(data)),
  };

  data.build = { year: new Date().getFullYear() };

  return data;
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

  const data = computeViewModel(content);
  const html = renderTemplate(template, data);

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  fs.writeFileSync(path.join(DIST_DIR, "index.html"), html);
  copyDir(path.join(ROOT, "css"), path.join(DIST_DIR, "css"));
  copyDir(path.join(ROOT, "js"), path.join(DIST_DIR, "js"));
  copyDir(path.join(ROOT, "assets"), path.join(DIST_DIR, "assets"));
  // reference/ (local-only UI/UX reference material) is never copied — dist/
  // only ever gets css/, js/, assets/ and the rendered index.html, above.
  fs.writeFileSync(path.join(DIST_DIR, "_headers"), buildHeaders());

  console.log(`[build] OK — wrote ${path.relative(ROOT, DIST_DIR)}/ (index.html, css/, js/, assets/, _headers)`);
}

main();
