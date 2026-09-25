import { test, expect } from "@playwright/test";
import { VARIANT_PORTS } from "../playwright.config.mjs";

// Default build = content/site.json as shipped (crnobela + narandzasta).
// Variants (teget / limeta / plava) come from build-variant.mjs.
const variantUrl = (name) => `http://localhost:${VARIANT_PORTS[name]}/`;

// Screenshots for review land in tests/e2e/screenshots/ (gitignored).
const SECTIONS = [
  ["hero", ".hero"],
  ["usluge", "#usluge"],
  ["radionica", "#radionica"],
  ["kontakt", "#kontakt"],
  ["footer", ".footer"],
];

function collectErrors(page) {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

for (const width of [1280, 375]) {
  test(`narandzasta screenshots at ${width}px, no console errors, no horizontal scroll`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "crnobela");
    // Hide the sticky header/bottom bar so they don't cover the section shots.
    await page.addStyleTag({ content: ".header,.bottombar{visibility:hidden}" });
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager")));
    await page.waitForLoadState("networkidle");
    for (const [name, selector] of SECTIONS) {
      await page.locator(selector).screenshot({ path: `screenshots/narandzasta-${name}-${width}.png` });
    }
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    expect(errors).toEqual([]);
  });
}

for (const [name, rgb, hex] of [
  ["limeta", "rgb(181, 242, 61)", "b5f23d"],
  ["plava", "rgb(60, 188, 250)", "3cbcfa"],
]) {
  test(`${name} preset: eyebrow color and logo`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(variantUrl(name));
    expect(await page.locator(".eyebrow").evaluate((el) => getComputedStyle(el).color)).toBe(rgb);
    await expect(page.locator(".header .logo img")).toHaveAttribute("src", `/assets/theme/3d-mdl-wordmark-${hex}.svg`);
    expect(await page.locator(".header .logo img").evaluate((img) => img.naturalWidth > 0)).toBe(true);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", `/assets/logo/accents/3d-icon-${name}-512.png`);
    expect(errors).toEqual([]);
  });
}

test("scrolling to #cene marks the 'Cene' menu link active (accent + aria-current)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(variantUrl("limeta"));
  const cene = page.locator('#siteNav a[href="#cene"]');
  await expect(cene).not.toHaveClass(/is-active/);

  await page.evaluate(() => {
    const s = document.getElementById("cene");
    window.scrollTo({ top: s.offsetTop + s.offsetHeight / 2 - window.innerHeight / 2, behavior: "instant" });
  });
  await expect(cene).toHaveClass(/is-active/);
  await expect(cene).toHaveAttribute("aria-current", "true");
  await expect(page.locator("#siteNav a.is-active")).toHaveCount(1);
  await expect.poll(() => cene.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(181, 242, 61)");

  // Back at the top (hero has no menu link) the highlight clears.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator("#siteNav a.is-active")).toHaveCount(0);
});

test("mobile menu: the active link gets the accent left border", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.evaluate(() => {
    const s = document.getElementById("radionica");
    window.scrollTo({ top: s.offsetTop + 200, behavior: "instant" });
  });
  const link = page.locator('#siteNav a[href="#radionica"]');
  await expect(link).toHaveClass(/is-active/);
  await page.locator("#navToggle").click();
  const border = await link.evaluate((el) => [getComputedStyle(el).borderLeftWidth, getComputedStyle(el).borderLeftColor]);
  expect(border).toEqual(["3px", "rgb(255, 122, 26)"]);
});

test("buttons are white with black text, and take the accent on hover", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // no transition to wait for
  await page.goto("/");
  const btn = page.locator(".hero .btn:not(.btn--ghost)");
  const colors = () => btn.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
  expect(await colors()).toEqual(["rgb(255, 255, 255)", "rgb(10, 10, 10)"]);
  await btn.hover();
  expect(await colors()).toEqual(["rgb(255, 122, 26)", "rgb(10, 10, 10)"]);

  const ghost = page.locator(".hero .btn--ghost");
  await ghost.hover();
  expect(await ghost.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).borderTopColor])).toEqual([
    "rgb(255, 122, 26)",
    "rgb(255, 122, 26)",
  ]);
});

test("teget build still renders the navy/red theme with the original logo", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(variantUrl("teget"));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "teget");
  await expect(page.locator("#theme-accent")).toHaveCount(0);
  await expect(page.locator(".header .logo img")).toHaveAttribute("src", "/assets/logo/3d-mdl-wordmark.svg");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(7, 11, 20)");
  const btn = await page.locator(".hero .btn").first().evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
  expect(btn).toEqual(["rgb(255, 255, 255)", "rgb(225, 29, 46)"]);
  expect(await page.locator(".equip img").first().evaluate((el) => getComputedStyle(el).filter)).not.toContain("grayscale");
  await page.locator(".hero").screenshot({ path: "screenshots/teget-hero-1280.png" });
  expect(errors).toEqual([]);
});
