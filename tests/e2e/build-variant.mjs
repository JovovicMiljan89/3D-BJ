// Builds content/site.json with a small patch into dist-variants/<name>/, so the
// e2e suite can serve theme variants next to the real build (see playwright.config.mjs).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const VARIANTS = {
  teget: (c) => (c.theme.base = "teget"),
  // A real price so the #cene section (and its menu link) exists.
  limeta: (c) => {
    c.theme.accent = "limeta";
    c.prices.items[0].from = 1500;
  },
  plava: (c) => (c.theme.accent = "plava"),
};

const name = process.argv[2];
if (name) {
  if (!VARIANTS[name]) throw new Error(`Unknown variant "${name}" — one of: ${Object.keys(VARIANTS).join(", ")}`);
  const outDir = path.join(ROOT, "dist-variants");
  fs.mkdirSync(outDir, { recursive: true });
  const content = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "site.json"), "utf-8"));
  VARIANTS[name](content);
  const contentPath = path.join(outDir, `${name}.json`);
  fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], {
    env: { ...process.env, BUILD_CONTENT: contentPath, BUILD_DIST_DIR: path.join(outDir, name) },
    stdio: "ignore",
  });
}
