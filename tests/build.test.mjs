import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { validateContent } from "../scripts/lib/validate.mjs";
import { renderTemplate } from "../scripts/lib/render.mjs";
import { escapeHtml } from "../scripts/lib/escape.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadRealContent() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "content", "site.json"), "utf-8"));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

test("valid content/site.json passes validation", () => {
  const content = loadRealContent();
  const { valid, errors } = validateContent(content, ROOT);
  assert.equal(valid, true, `Expected valid, got errors: ${errors.join("; ")}`);
});

test("a missing required field fails validation with a clear message", () => {
  const content = deepClone(loadRealContent());
  delete content.hero.headline;

  const { valid, errors } = validateContent(content, ROOT);
  assert.equal(valid, false);
  assert.ok(
    errors.some((e) => e.includes("hero.headline")),
    `Expected an error mentioning "hero.headline", got: ${errors.join("; ")}`
  );
});

test("a missing image file fails validation", () => {
  const content = deepClone(loadRealContent());
  content.hero.image = "/assets/images/this-file-does-not-exist.svg";

  const { valid, errors } = validateContent(content, ROOT);
  assert.equal(valid, false);
  assert.ok(
    errors.some((e) => e.includes("hero.image") && e.includes("this-file-does-not-exist.svg")),
    `Expected an image-not-found error, got: ${errors.join("; ")}`
  );
});

test("an empty required list fails validation", () => {
  const content = deepClone(loadRealContent());
  content.services = [];

  const { valid, errors } = validateContent(content, ROOT);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('"services"')));
});

test("a nested list (equipment specs) is validated too", () => {
  const content = deepClone(loadRealContent());
  content.workshop.equipment[0].specs = [];

  const { valid, errors } = validateContent(content, ROOT);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("workshop.equipment[0].specs")));
});

test("renderTemplate HTML-escapes interpolated text", () => {
  const html = renderTemplate("<h1>{{title}}</h1>", { title: `<script>alert("x")</script> & 'quotes'` });
  assert.ok(!html.includes("<script>"), "raw <script> must not appear in output");
  assert.equal(
    html,
    "<h1>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quotes&#39;</h1>"
  );
});

test("renderTemplate handles nested #each blocks", () => {
  const template = "{{#each items}}<p>{{name}}:{{#each tags}} {{this}}{{/each}}</p>{{/each}}";
  const html = renderTemplate(template, {
    items: [
      { name: "A", tags: ["x", "y"] },
      { name: "B", tags: ["z"] },
    ],
  });
  assert.equal(html, "<p>A: x y</p><p>B: z</p>");
});

test("renderTemplate exposes @index1 inside an each loop", () => {
  const template = "{{#each items}}{{@index1}}:{{this}} {{/each}}";
  const html = renderTemplate(template, { items: ["a", "b", "c"] });
  assert.equal(html, "1:a 2:b 3:c ");
});

test("escapeHtml escapes all five special characters", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("npm run build succeeds against the real content and produces dist/index.html with no leftover placeholders", () => {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, stdio: "pipe" });

  const distIndex = path.join(ROOT, "dist", "index.html");
  assert.ok(fs.existsSync(distIndex), "dist/index.html should exist after build");

  const html = fs.readFileSync(distIndex, "utf-8");
  assert.ok(!html.includes("{{"), "rendered HTML must not contain leftover {{ placeholders }}");
  assert.ok(html.includes("<title>"), "rendered HTML should include a <title>");
});

test("build fails (non-zero exit) when content/site.json has a missing image", () => {
  const contentPath = path.join(ROOT, "content", "site.json");
  const backup = fs.readFileSync(contentPath, "utf-8");
  try {
    const broken = deepClone(JSON.parse(backup));
    broken.hero.image = "/assets/images/does-not-exist.svg";
    fs.writeFileSync(contentPath, JSON.stringify(broken, null, 2));

    assert.throws(() => {
      execFileSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, stdio: "pipe" });
    });
  } finally {
    fs.writeFileSync(contentPath, backup);
  }
});
