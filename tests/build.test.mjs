import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { validateContent } from "../scripts/lib/validate.mjs";
import { renderTemplate } from "../scripts/lib/render.mjs";
import { escapeHtml } from "../scripts/lib/escape.mjs";
import { bwPath, toBwSvg, BW_COLOR_MAP } from "../scripts/lib/bw.mjs";
import { resolveAccent, accentCss, recolorSvg, loadPresets, contrastRatio, darken, textOn } from "../scripts/lib/theme.mjs";

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

// ---------- Template engine: {{#if}} and {{{raw}}} ----------

test("renderTemplate #if renders children only when the value is truthy", () => {
  const template = "[{{#if show}}yes{{/if}}]";
  assert.equal(renderTemplate(template, { show: true }), "[yes]");
  assert.equal(renderTemplate(template, { show: "non-empty" }), "[yes]");
  assert.equal(renderTemplate(template, { show: ["a"] }), "[yes]");
  assert.equal(renderTemplate(template, { show: false }), "[]");
  assert.equal(renderTemplate(template, { show: "" }), "[]");
  assert.equal(renderTemplate(template, { show: [] }), "[]");
  assert.equal(renderTemplate(template, { show: 0 }), "[]");
  assert.equal(renderTemplate(template, {}), "[]");
});

test("renderTemplate #if works nested inside #each, against the item's own scope", () => {
  const template = "{{#each items}}{{name}}{{#if featured}}*{{/if}} {{/each}}";
  const html = renderTemplate(template, {
    items: [
      { name: "A", featured: true },
      { name: "B", featured: false },
    ],
  });
  assert.equal(html, "A* B ");
});

test("renderTemplate {{{raw}}} does not HTML-escape its value", () => {
  const html = renderTemplate('<script type="application/ld+json">{{{json}}}</script>', {
    json: '{"a":"<b>"}',
  });
  assert.equal(html, '<script type="application/ld+json">{"a":"<b>"}</script>');
});

// ---------- Hide-empty / zero-value build behavior ----------

function buildDistWith(mutateFn) {
  const contentPath = path.join(ROOT, "content", "site.json");
  const backup = fs.readFileSync(contentPath, "utf-8");
  try {
    const mutated = deepClone(JSON.parse(backup));
    mutateFn(mutated);
    fs.writeFileSync(contentPath, JSON.stringify(mutated, null, 2));
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, stdio: "pipe" });
    return fs.readFileSync(path.join(ROOT, "dist", "index.html"), "utf-8");
  } finally {
    fs.writeFileSync(contentPath, backup);
  }
}

test("prices section is hidden entirely when every card has from <= 0 (the shipped default)", () => {
  const html = buildDistWith(() => {}); // real content.json ships all prices at 0
  assert.ok(!html.includes('id="cene"'), "the #cene section should not be rendered");
  assert.ok(!html.includes("#cene"), "nav should not link to #cene either");
  assert.ok(!/\b0\s*din\b/i.test(html), 'rendered HTML must never show "0 din"');
});

test("prices section appears, but only shows cards with a real (>0) price", () => {
  const pricedTitle = loadRealContent().prices.items[0].title;
  const html = buildDistWith((content) => {
    content.prices.items[0].from = 1500; // only this one gets a real price
  });
  assert.ok(html.includes('id="cene"'), "the #cene section should render once at least one card has a price");
  assert.ok(html.includes(pricedTitle), "the priced card's title should appear");
  // The other two cards (from: 0) must stay hidden.
  const priceCount = (html.match(/<article class="price-card/g) || []).length;
  assert.equal(priceCount, 1, "only the one priced card should render");
});

test("empty optional contact channels (viber, whatsapp, instagram, facebook, city, pib) are not rendered", () => {
  const html = buildDistWith((content) => {
    for (const key of ["viber", "whatsapp", "instagram", "facebook", "city", "pib"]) content.contact[key] = "";
  });
  assert.ok(!html.includes("viber://chat"), "no Viber link when contact.viber is empty");
  assert.ok(!html.includes("wa.me/"), "no WhatsApp link when contact.whatsapp is empty");
  assert.ok(!html.includes(">Instagram<"), "no Instagram link when contact.instagram is empty");
  assert.ok(!html.includes(">Facebook<"), "no Facebook link when contact.facebook is empty");
  assert.ok(!/PIB:/.test(html), "no PIB line when contact.pib is empty");
});

test("filling an optional contact channel makes it appear", () => {
  const html = buildDistWith((content) => {
    content.contact.viber = "381601234567";
  });
  assert.ok(html.includes("viber://chat?number=%2B381601234567"), "Viber link should render once contact.viber is set");
});

test("no placeholder/example text leaks into the rendered page", () => {
  const html = buildDistWith(() => {});
  assert.ok(!/\bexample\b/i.test(html), 'rendered HTML must not contain the word "example"');
});

// ---------- SEO: OG tags + JSON-LD ----------

test("Open Graph / Twitter tags use absolute URLs built from seo.siteUrl", () => {
  const html = buildDistWith((c) => (c.theme.base = "teget"));
  const content = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "site.json"), "utf-8"));
  const expectedImage = content.seo.siteUrl.replace(/\/$/, "") + content.seo.ogImage;

  assert.ok(html.includes(`property="og:url" content="${content.seo.siteUrl}"`));
  assert.ok(html.includes(`property="og:image" content="${expectedImage}"`));
  assert.ok(html.includes(`name="twitter:image" content="${expectedImage}"`));
  assert.ok(expectedImage.startsWith("http"), "og:image must be an absolute URL");
});

test("the LocalBusiness JSON-LD block is present and is valid, parseable JSON", () => {
  const html = buildDistWith(() => {});
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, "expected a JSON-LD <script> tag in the rendered page");

  let data;
  assert.doesNotThrow(() => {
    data = JSON.parse(match[1]);
  }, "JSON-LD content must be valid JSON");

  assert.equal(data["@type"], "LocalBusiness");
  assert.equal(data["@context"], "https://schema.org");
  assert.ok(typeof data.name === "string" && data.name.length > 0);
  assert.ok(data.image.startsWith("http"), "JSON-LD image must be an absolute URL");
});

// ---------- Toggleable sections: "Za firme" and "Rezervni delovi" ----------

test("both new sections render by default, with their content from site.json", () => {
  const content = loadRealContent();
  const html = buildDistWith(() => {});
  assert.ok(html.includes('id="za-firme"'), "the #za-firme section should render");
  assert.ok(html.includes('id="rezervni-delovi"'), "the #rezervni-delovi section should render");
  assert.ok(html.includes(escapeHtml(content.business.heading)));
  assert.ok(html.includes(escapeHtml(content.spareParts.heading)));
  for (const point of content.business.points) assert.ok(html.includes(escapeHtml(point)));
  const spareSteps = html.split('id="rezervni-delovi"')[1].split("</section>")[0];
  assert.equal((spareSteps.match(/<li>/g) || []).length, content.spareParts.items.length);
  assert.ok(html.includes(`data-prefill-service="${escapeHtml(content.spareParts.formService)}"`));
  assert.ok(html.includes(`data-prefill-message="${escapeHtml(content.spareParts.formMessage)}"`));
});

test("a missing enabled flag defaults to showing the section", () => {
  const html = buildDistWith((content) => {
    delete content.business.enabled;
    delete content.spareParts.enabled;
  });
  assert.ok(html.includes('id="za-firme"'));
  assert.ok(html.includes('id="rezervni-delovi"'));
});

test("enabled: false hides a section entirely, even with its other fields left empty", () => {
  const html = buildDistWith((content) => {
    content.business = { enabled: false, tag: "", heading: "", text: "", points: [], buttonLabel: "" };
    content.spareParts.enabled = false;
  });
  assert.ok(!html.includes('id="za-firme"'), "#za-firme must not render when disabled");
  assert.ok(!html.includes('id="rezervni-delovi"'), "#rezervni-delovi must not render when disabled");
  assert.ok(!html.includes("data-prefill-message"));
});

test("an enabled new section with a missing required field fails validation", () => {
  const content = deepClone(loadRealContent());
  content.business.heading = "";
  content.spareParts.items[1].title = "";
  content.business.points = [];

  const { valid, errors } = validateContent(content, ROOT);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("business.heading")), errors.join("; "));
  assert.ok(errors.some((e) => e.includes("business.points")), errors.join("; "));
  assert.ok(errors.some((e) => e.includes("spareParts.items[1]")), errors.join("; "));
});

test("a non-boolean enabled flag fails validation", () => {
  const content = deepClone(loadRealContent());
  content.spareParts.enabled = "da";
  const { valid, errors } = validateContent(content, ROOT);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("spareParts.enabled")));
});

test("hero headline renders its accent part in a span, and omits the span when empty", () => {
  const content = loadRealContent();
  const html = buildDistWith(() => {});
  assert.ok(html.includes(`<h1>${escapeHtml(content.hero.headline)} <span class="accent">${escapeHtml(content.hero.headlineAccent)}</span></h1>`));
  const plain = buildDistWith((c) => {
    c.hero.headlineAccent = "";
  });
  assert.ok(plain.includes(`<h1>${escapeHtml(content.hero.headline)}</h1>`));
});

test("CSS and JS are emitted with content-hashed file names and referenced from index.html", () => {
  const html = buildDistWith(() => {});
  const css = html.match(/href="\/css\/(styles\.[0-9a-f]{10}\.css)"/);
  const js = html.match(/src="\/js\/(main\.[0-9a-f]{10}\.js)"/);
  assert.ok(css, "stylesheet link should use a hashed file name");
  assert.ok(js, "script tag should use a hashed file name");
  assert.ok(fs.existsSync(path.join(ROOT, "dist", "css", css[1])));
  assert.ok(fs.existsSync(path.join(ROOT, "dist", "js", js[1])));
  assert.ok(!fs.existsSync(path.join(ROOT, "dist", "css", "styles.css")), "unhashed copy must not be shipped");
});

// ---------- Brand / logo ----------

test("header and footer logo src equal brand.logo, with width matching the SVG's aspect ratio", () => {
  const { brand } = loadRealContent();
  const html = buildDistWith((c) => (c.theme.base = "teget"));
  const vb = fs
    .readFileSync(path.join(ROOT, brand.logo.replace(/^\//, "")), "utf-8")
    .match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/);
  const ratio = parseFloat(vb[1]) / parseFloat(vb[2]);

  const header = html.match(/<a href="#top" class="logo">\s*<img src="([^"]+)" alt="([^"]+)" height="40" width="(\d+)"/);
  assert.ok(header, "header logo <img> not found");
  assert.equal(header[1], brand.logo);
  assert.equal(header[2], brand.name);
  assert.equal(Number(header[3]), Math.round(40 * ratio));

  const footer = html.match(/<img src="([^"]+)" alt="[^"]+" height="32" width="(\d+)" loading="lazy" \/>/);
  assert.equal(footer[1], brand.logo);
  assert.equal(Number(footer[2]), Math.round(32 * ratio));
});

test("og:image is an absolute URL whose file exists in dist/", () => {
  const { seo } = loadRealContent();
  const html = buildDistWith(() => {});
  const og = html.match(/property="og:image" content="([^"]+)"/)[1];
  assert.ok(og.startsWith(seo.siteUrl), `og:image must be absolute under ${seo.siteUrl}, got ${og}`);
  const rel = new URL(og).pathname.replace(/^\//, "");
  assert.ok(fs.existsSync(path.join(ROOT, "dist", rel)), `dist/${rel} should exist`);
});

test('no rendered HTML contains the old brand name "3D-BJ"', () => {
  const html = buildDistWith(() => {});
  assert.ok(!html.includes("3D-BJ"), "found 3D-BJ in dist/index.html");
  assert.ok(!fs.readFileSync(path.join(ROOT, "js", "main.js"), "utf-8").includes("3D-BJ"), "found 3D-BJ in js/main.js");
});

test("favicon and apple-touch-icon links point to files that exist in dist/", () => {
  const html = buildDistWith(() => {});
  for (const rel of ["icon", "apple-touch-icon"]) {
    const href = html.match(new RegExp(`<link rel="${rel}" href="([^"]+)"`))[1];
    assert.ok(fs.existsSync(path.join(ROOT, "dist", href.replace(/^\//, ""))), `${rel} ${href} should exist in dist/`);
  }
});

test("brand.name drives the title, og:site_name, JSON-LD and the Web3Forms subject", () => {
  const html = buildDistWith((c) => {
    c.brand.name = "Test Brand";
  });
  assert.ok(html.includes("<title>Test Brand | "));
  assert.ok(html.includes('property="og:site_name" content="Test Brand"'));
  assert.ok(html.includes('data-brand-name="Test Brand"'));
  const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(jsonLd.name, "Test Brand");
  assert.ok(jsonLd.logo.startsWith("http"), "JSON-LD logo must be an absolute URL");
});

test("maker avatar falls back to brand.mark while no photo is set", () => {
  const { brand } = loadRealContent();
  const html = buildDistWith((c) => (c.theme.base = "teget"));
  assert.ok(html.includes(`<img class="maker__avatar" src="${brand.mark}"`));
});

test("_headers: css/js stay immutable (hashed names), /assets/* is not immutable", () => {
  buildDistWith(() => {});
  const headers = fs.readFileSync(path.join(ROOT, "dist", "_headers"), "utf-8");
  const block = (p) => headers.split(`\n${p}\n`)[1].split("\n\n")[0];
  assert.match(block("/css/*"), /immutable/);
  assert.match(block("/js/*"), /immutable/);
  assert.doesNotMatch(block("/assets/*"), /immutable/);
});

// ---------- Images / stock placeholders ----------

// Every "/assets/..." string anywhere in site.json.
function collectAssetPaths(value, out = []) {
  if (typeof value === "string" && value.startsWith("/assets/")) out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectAssetPaths(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectAssetPaths(v, out));
  return out;
}

test("every image referenced in site.json exists in dist/", () => {
  buildDistWith(() => {});
  const paths = collectAssetPaths(loadRealContent());
  assert.ok(paths.length > 10, "expected to find the site's image references");
  for (const p of paths) {
    assert.ok(fs.existsSync(path.join(ROOT, "dist", p.replace(/^\//, ""))), `dist${p} is missing`);
  }
});

test("no gallery or equipment image is larger than 300 KB", () => {
  const content = loadRealContent();
  const images = [...content.gallery.map((g) => g.image), ...content.workshop.equipment.map((e) => e.image)];
  for (const img of images) {
    const size = fs.statSync(path.join(ROOT, img.replace(/^\//, ""))).size;
    assert.ok(size <= 300 * 1024, `${img} is ${Math.round(size / 1024)} KB (max 300 KB)`);
  }
});

test("WebP images get their real width/height on <img>", () => {
  const html = buildDistWith((c) => {
    c.gallery[0].image = "/assets/uploads/stock/galerija-zupcanik.webp";
  });
  assert.ok(/src="\/assets\/uploads\/stock\/galerija-zupcanik\.webp" alt="[^"]*" width="1200" height="1500"/.test(html));
});

test("placeholder: true is never shown on the page, and the build warns about each such item", () => {
  const contentPath = path.join(ROOT, "content", "site.json");
  const backup = fs.readFileSync(contentPath, "utf-8");
  try {
    const c = JSON.parse(backup);
    c.gallery.forEach((g, i) => (g.placeholder = i === 0));
    c.workshop.equipment.forEach((e, i) => (e.placeholder = i === 1));
    fs.writeFileSync(contentPath, JSON.stringify(c, null, 2));
    const out = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, encoding: "utf-8" });
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stderr, /2 image\(s\) are still temporary stock photos/);
    assert.ok(out.stderr.includes(`gallery[0] "${c.gallery[0].caption}"`));
    assert.ok(out.stderr.includes(`workshop.equipment[1] "${c.workshop.equipment[1].title}"`));
    assert.ok(!out.stderr.includes("gallery[1]"));

    const html = fs.readFileSync(path.join(ROOT, "dist", "index.html"), "utf-8");
    assert.ok(!/placeholder(?!=)/i.test(html.replace(/placeholder="[^"]*"/g, "")), "no placeholder badge/flag in the HTML");

    c.gallery.forEach((g) => (g.placeholder = false));
    c.workshop.equipment.forEach((e) => (e.placeholder = false));
    fs.writeFileSync(contentPath, JSON.stringify(c, null, 2));
    const clean = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, encoding: "utf-8" });
    assert.ok(!clean.stderr.includes("stock photos"), "no warning once every placeholder is cleared");
  } finally {
    fs.writeFileSync(contentPath, backup);
  }
});

test("a non-boolean placeholder flag fails validation", () => {
  const content = deepClone(loadRealContent());
  content.gallery[0].placeholder = "da";
  const { valid, errors } = validateContent(content, ROOT);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("gallery[0].placeholder")));
});

test("Viber/WhatsApp show the formatted phone number when it's the same number, else +digits", () => {
  const html = buildDistWith((c) => {
    c.contact.phoneTel = "+381659738702";
    c.contact.phoneDisplay = "+381 65 973 8702";
    c.contact.viber = "381659738702";
    c.contact.whatsapp = "381601234567";
  });
  assert.ok(html.includes("<small>Viber</small><br />+381 65 973 8702</span>"));
  assert.ok(html.includes("<small>WhatsApp</small><br />+381601234567</span>"));
  assert.ok(html.includes('href="viber://chat?number=%2B381659738702"'), "link still uses the bare digits");
});

// ---------- Web3Forms ----------

test("the rendered form carries the real Web3Forms key from site.json", () => {
  const { contact } = loadRealContent();
  assert.match(contact.web3formsKey, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "key should be a UUID");
  const html = buildDistWith(() => {});
  assert.ok(html.includes(`<input type="hidden" name="access_key" value="${contact.web3formsKey}" />`));
  assert.ok(!html.includes("YOUR_WEB3FORMS_ACCESS_KEY"));
  assert.ok(!/\saction=/.test(html.match(/<form[^>]*>/)[0]), "the form must not have an action (JS handles submit)");
});

test("the build fails when the Web3Forms key is empty or still the placeholder", () => {
  for (const key of ["", "   ", "YOUR_WEB3FORMS_ACCESS_KEY"]) {
    const content = deepClone(loadRealContent());
    content.contact.web3formsKey = key;
    const { valid, errors } = validateContent(content, ROOT);
    assert.equal(valid, false, `key ${JSON.stringify(key)} should fail`);
    assert.ok(errors.some((e) => e.includes("contact.web3formsKey")), errors.join("; "));
  }
});

test("no Content-Security-Policy blocks api.web3forms.com", () => {
  const html = buildDistWith(() => {});
  const headers = fs.readFileSync(path.join(ROOT, "dist", "_headers"), "utf-8");
  const policies = [
    ...headers.split("\n").filter((l) => /content-security-policy/i.test(l)),
    ...(html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/gi) || []),
  ];
  for (const csp of policies) {
    const connect = csp.match(/connect-src([^;"]*)/i);
    const fallback = csp.match(/default-src([^;"]*)/i);
    const src = (connect || fallback)?.[1] || "*";
    assert.ok(/\*|https:\/\/api\.web3forms\.com/.test(src), `CSP would block api.web3forms.com: ${csp}`);
  }
});

test("/admin redirects to this repo's Pages CMS editor", () => {
  buildDistWith(() => {});
  const redirects = fs.readFileSync(path.join(ROOT, "dist", "_redirects"), "utf-8");
  for (const from of ["/admin", "/admin/", "/admin/*"]) {
    assert.ok(
      redirects.includes(`${from} https://app.pagescms.org/JovovicMiljan89/3D-BJ/static-cms 302\n`),
      `missing redirect for ${from}`
    );
  }
});

// ---------- Color themes ----------

test("data-theme on <html> matches site.json, and theme-color follows the theme's --bg", () => {
  const bw = buildDistWith((c) => (c.theme.base = "crnobela"));
  assert.match(bw, /<html lang="sr" data-theme="crnobela" data-photos="grayscale">/);
  assert.ok(bw.includes('<meta name="theme-color" content="#0a0a0a" />'));

  const teget = buildDistWith((c) => (c.theme.base = "teget"));
  assert.match(teget, /<html lang="sr" data-theme="teget">/, "teget never gets grayscale photos");
  assert.ok(teget.includes('<meta name="theme-color" content="#070b14" />'));

  const missing = buildDistWith((c) => delete c.theme);
  assert.match(missing, /data-theme="crnobela"/, "crnobela is the default");
});

test("built CSS: navy/red literals appear only inside the teget token block", () => {
  buildDistWith(() => {});
  const cssFile = fs.readdirSync(path.join(ROOT, "dist", "css")).find((f) => f.endsWith(".css"));
  const css = fs.readFileSync(path.join(ROOT, "dist", "css", cssFile), "utf-8");
  const tegetBlock = css.match(/:root\[data-theme="teget"\]\s*\{[^}]*\}/)[0];
  const outside = css.replace(tegetBlock, "");
  for (const lit of ["#e11d2e", "#b3121f", "#1b2d55", "#2f4f9a", "#070b14", "rgba(225, 29, 46", "rgba(225,29,46"]) {
    assert.ok(!outside.toLowerCase().includes(lit), `${lit} found outside the teget block`);
  }
  assert.ok(tegetBlock.includes("#e11d2e"), "teget keeps its red");
});

test("B&W SVG recoloring: exact mapping, dark nozzle dot, unmapped colors rejected", () => {
  assert.equal(BW_COLOR_MAP["#e11d2e"], "#ffffff");
  const out = toBwSvg('<svg><rect fill="#E11D2E"/><polygon fill="#1b2d55"/><circle cx="60" cy="34" r="5" fill="#e7ecf6"/></svg>');
  assert.equal(out, '<svg><rect fill="#ffffff"/><polygon fill="#262626"/><circle cx="60" cy="34" r="5" fill="#0a0a0a"/></svg>');
  assert.throws(() => toBwSvg('<svg><rect fill="#00ff00"/></svg>'), /Unmapped colors/);
  for (const f of ["assets/logo/3d-mdl-wordmark-bw.svg", "assets/logo/3d-mdl-mark-bw.svg", "assets/logo/3d-mdl-icon-bw.svg", "assets/images/hero-printer-bw.svg"]) {
    const svg = fs.readFileSync(path.join(ROOT, f), "utf-8");
    assert.equal(svg, toBwSvg(fs.readFileSync(path.join(ROOT, f.replace("-bw", "")), "utf-8")), `${f} is stale — rerun make-bw-assets`);
  }
});

// ---------- Accent color (Izgled sajta) ----------

function buildWithOutput(mutateFn) {
  const contentPath = path.join(ROOT, "content", "site.json");
  const backup = fs.readFileSync(contentPath, "utf-8");
  try {
    const c = JSON.parse(backup);
    mutateFn(c);
    fs.writeFileSync(contentPath, JSON.stringify(c, null, 2));
    const out = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, encoding: "utf-8" });
    const html = out.status === 0 ? fs.readFileSync(path.join(ROOT, "dist", "index.html"), "utf-8") : "";
    return { ...out, html };
  } finally {
    fs.writeFileSync(contentPath, backup);
  }
}

test("each preset produces the expected CSS variables from akcenti.json", () => {
  const presets = loadPresets();
  assert.deepEqual(Object.keys(presets), ["crvena", "narandzasta", "zuta", "limeta", "plava"]);
  for (const [key, p] of Object.entries(presets)) {
    const css = accentCss(resolveAccent({ accent: key }, presets));
    assert.ok(css.startsWith(':root[data-theme="crnobela"] {'), css);
    assert.ok(css.includes(`--primary: ${p.akcenat};`), `${key} --primary`);
    assert.ok(css.includes(`--accent: ${p.akcenat};`), `${key} --accent`);
    assert.ok(css.includes(`--primary-dark: ${p.tamniji};`), `${key} --primary-dark`);
    assert.ok(css.includes(`--on-accent: ${p.tekst_na_akcentu};`), `${key} --on-accent`);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.akcenat.slice(i, i + 2), 16));
    assert.ok(css.includes(`--primary-soft: rgba(${r}, ${g}, ${b}, 0.13);`), `${key} --primary-soft`);
    assert.ok(css.includes(`--glow: rgba(${r}, ${g}, ${b}, 0.1);`), `${key} --glow`);
  }
});

test("a preset build injects its accent inline, after the stylesheet", () => {
  const html = buildDistWith((c) => (c.theme.accent = "plava"));
  const style = html.match(/<style id="theme-accent">([^<]*)<\/style>/);
  assert.ok(style, "inline accent <style> missing");
  assert.ok(style[1].includes("--primary: #3cbcfa;"));
  assert.ok(html.indexOf('rel="stylesheet"') < html.indexOf('id="theme-accent"'), "inline style must come after the stylesheet to win");
});

test("custom color #ff00aa gets a computed darker color and text color", () => {
  const a = resolveAccent({ accent: "prilagodjena", customAccent: "#FF00AA" });
  assert.equal(a.accent, "#ff00aa");
  assert.equal(a.darker, darken("#ff00aa"));
  assert.equal(a.darker, "#cc0088", "20% darker in HSL");
  assert.equal(a.onAccent, "#0a0a0a", "black reads better than white on #ff00aa");
  assert.ok(contrastRatio("#ff00aa", "#0a0a0a") > contrastRatio("#ff00aa", "#ffffff"));
  assert.equal(textOn("#1a3cff"), "#ffffff", "dark blue gets white text");
  assert.deepEqual(a.warnings, []);

  const { status, html } = buildWithOutput((c) => {
    c.theme.accent = "prilagodjena";
    c.theme.customAccent = "#ff00aa";
  });
  assert.equal(status, 0);
  assert.ok(html.includes("--primary: #ff00aa; --primary-dark: #cc0088;"));
  // Custom color: SVGs recolored, rasters fall back to the neutral B&W versions.
  assert.ok(html.includes('src="/assets/theme/3d-mdl-wordmark-ff00aa.svg"'));
  assert.ok(html.includes('<link rel="apple-touch-icon" href="/assets/logo/3d-mdl-icon-512-bw.png"'));
  assert.ok(html.includes("/assets/og/og-image-mdl-bw.png"));
  const svg = fs.readFileSync(path.join(ROOT, "dist", "assets", "theme", "3d-mdl-wordmark-ff00aa.svg"), "utf-8");
  assert.ok(svg.includes("#ff00aa") && svg.includes("#cc0088") && !svg.includes("#e11d2e"));
});

test("an invalid custom hex fails the build with a Serbian message", () => {
  for (const bad of ["ff7a1a", "#ff7a1", "#gg0000", "narandžasta", ""]) {
    const content = deepClone(loadRealContent());
    content.theme.accent = "prilagodjena";
    content.theme.customAccent = bad;
    const { valid, errors } = validateContent(content, ROOT);
    assert.equal(valid, false, `"${bad}" should be rejected`);
    assert.ok(errors.some((e) => e.includes("Prilagođena boja") && e.includes("#rrggbb")), errors.join("; "));
  }
  const { status, stderr } = buildWithOutput((c) => {
    c.theme.accent = "prilagodjena";
    c.theme.customAccent = "#12345";
  });
  assert.notEqual(status, 0, "build must fail");
  assert.match(stderr, /Prilagođena boja: "#12345" nije ispravna boja/);
});

test("a dark custom color (#111111) builds but prints a contrast warning", () => {
  const { status, stderr } = buildWithOutput((c) => {
    c.theme.accent = "prilagodjena";
    c.theme.customAccent = "#111111";
  });
  assert.equal(status, 0, "a dark color is a warning, not an error");
  assert.match(stderr, /WARNING: Boja akcenta #111111 je previše tamna za crnu pozadinu/);

  const ok = buildWithOutput((c) => (c.theme.accent = "zuta"));
  assert.ok(!/previše tamna/.test(ok.stderr), "bright presets don't warn");
});

test("logo, mark, favicon, apple icon and OG image match the preset and the brand", () => {
  for (const accent of ["narandzasta", "limeta"]) {
    const hex = loadPresets()[accent].akcenat.slice(1);
    for (const [brandName, slug] of [["3D-MDL", "mdl"], ["3D-BJ", "bj"]]) {
      const { html } = buildWithOutput((c) => {
        c.theme.accent = accent;
        c.brand.name = brandName;
        if (slug === "bj") {
          c.brand.logo = "/assets/logo/3d-bj-wordmark.svg";
          c.brand.mark = "/assets/logo/3d-bj-mark.svg";
          c.brand.favicon = "/assets/logo/3d-bj-icon.svg";
        }
      });
      const base = slug === "bj" ? "3d-bj" : "3d-mdl";
      assert.ok(html.includes(`<a href="#top" class="logo">\n        <img src="/assets/theme/${base}-wordmark-${hex}.svg"`), `${accent}/${brandName} header logo`);
      assert.ok(html.includes(`<img class="maker__avatar" src="/assets/theme/${base}-mark-${hex}.svg"`), `${accent}/${brandName} mark`);
      assert.ok(html.includes(`<link rel="icon" href="/assets/theme/${base}-icon-${hex}.svg"`), `${accent}/${brandName} favicon`);
      assert.ok(html.includes(`<link rel="apple-touch-icon" href="/assets/logo/accents/3d-icon-${accent}-512.png"`));
      assert.ok(html.includes(`/assets/og/accents/og-${slug}-${accent}.png"`), `${accent}/${brandName} OG`);
    }
  }
});

test("build-time recoloring matches the provided accent files exactly", () => {
  const presets = loadPresets();
  const strip = (svg) => svg.replace(/aria-label="[^"]*"/, "");
  for (const key of Object.keys(presets)) {
    const mine = recolorSvg(fs.readFileSync(path.join(ROOT, "assets/logo/3d-mdl-icon.svg"), "utf-8"), resolveAccent({ accent: key }, presets));
    const provided = fs.readFileSync(path.join(ROOT, `assets/logo/accents/3d-bj-icon-${key}.svg`), "utf-8");
    assert.equal(strip(mine), strip(provided), `icon for ${key}`);
  }
  const hero = recolorSvg(fs.readFileSync(path.join(ROOT, "assets/images/hero-printer.svg"), "utf-8"), resolveAccent({ accent: "plava" }, presets));
  assert.ok(!/#e11d2e|#ff8a94|#24365c|#0a1020/i.test(hero), "no red/navy left in the hero");
});

test("the active-section script is present or absent according to the setting", () => {
  const on = buildDistWith((c) => (c.theme.highlightActiveSection = true));
  assert.ok(on.includes("IntersectionObserver") && on.includes('rootMargin: "-45% 0px -50% 0px"'));
  const off = buildDistWith((c) => (c.theme.highlightActiveSection = false));
  assert.ok(!off.includes("IntersectionObserver"));
});

test("teget ignores the accent: no inline accent style, original logos", () => {
  const html = buildDistWith((c) => {
    c.theme.base = "teget";
    c.theme.accent = "limeta";
  });
  assert.ok(!html.includes('id="theme-accent"'));
  assert.ok(html.includes('src="/assets/logo/3d-mdl-wordmark.svg"'));
  assert.match(html, /<html lang="sr" data-theme="teget">/);
});

test("grayscalePhotos: false keeps workshop/equipment photos in color", () => {
  const html = buildDistWith((c) => (c.theme.grayscalePhotos = false));
  assert.match(html, /<html lang="sr" data-theme="crnobela">/);
});

test("invalid Izgled sajta values fail validation", () => {
  const content = deepClone(loadRealContent());
  content.theme = { base: "zelena", accent: "ljubicasta", highlightActiveSection: "da", grayscalePhotos: 1 };
  const { valid, errors } = validateContent(content, ROOT);
  assert.equal(valid, false);
  for (const f of ["theme.base", "theme.accent", "theme.highlightActiveSection", "theme.grayscalePhotos"]) {
    assert.ok(errors.some((e) => e.includes(f)), `expected an error for ${f}: ${errors.join("; ")}`);
  }
});

test("buttons are white with black text in crnobela; accent only on hover", () => {
  const css = fs.readFileSync(path.join(ROOT, "css", "styles.css"), "utf-8");
  const crnobela = css.match(/:root,\s*:root\[data-theme="crnobela"\]\s*\{[^}]*\}/)[0];
  assert.match(crnobela, /--btn-bg: #ffffff; --btn-text: #0a0a0a;/);
  assert.match(crnobela, /--btn-hover-bg: var\(--primary\); --btn-hover-text: var\(--on-accent\);/);
  assert.match(css, /\.btn \{[^}]*background: var\(--btn-bg\);[^}]*color: var\(--btn-text\);/);
  // Text on any accent-filled element uses --on-accent.
  const rules = (css.match(/[^{}]+\{[^}]*background:\s*var\(--primary\)[^}]*\}/g) || []).filter((r) => !/content:\s*""/.test(r));
  for (const rule of rules) assert.match(rule, /color:\s*var\(--on-accent\)/, rule.trim().slice(0, 80));
  assert.ok(!/color:\s*#fff(fff)?\b/i.test(css.replace(/:root\[data-theme="teget"\]\s*\{[^}]*\}/, "")), "no literal white text outside teget");
});
