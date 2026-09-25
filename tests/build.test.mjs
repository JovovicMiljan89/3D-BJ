import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
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
  const html = buildDistWith(() => {});
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
  const html = buildDistWith(() => {});
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
  const html = buildDistWith(() => {});
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
