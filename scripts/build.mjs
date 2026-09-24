#!/usr/bin/env node
// Zero-dependency static site builder.
// content/site.json + src/index.template.html  -->  dist/
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateContent } from "./lib/validate.mjs";
import { renderTemplate } from "./lib/render.mjs";

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

  const data = { ...content, build: { year: new Date().getFullYear() } };
  const html = renderTemplate(template, data);

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  fs.writeFileSync(path.join(DIST_DIR, "index.html"), html);
  copyDir(path.join(ROOT, "css"), path.join(DIST_DIR, "css"));
  copyDir(path.join(ROOT, "js"), path.join(DIST_DIR, "js"));
  copyDir(path.join(ROOT, "assets"), path.join(DIST_DIR, "assets"));
  fs.writeFileSync(path.join(DIST_DIR, "_headers"), buildHeaders());

  console.log(`[build] OK — wrote ${path.relative(ROOT, DIST_DIR)}/ (index.html, css/, js/, assets/, _headers)`);
}

main();
