import { test, expect } from "@playwright/test";
import { TEGET_PORT } from "../playwright.config.mjs";

// Screenshots for review land in tests/e2e/screenshots/ (gitignored).
const SECTIONS = [
  ["hero", ".hero"],
  ["usluge", "#usluge"],
  ["radionica", "#radionica"],
  ["kontakt", "#kontakt"],
  ["footer", ".footer"],
];

for (const width of [1280, 375]) {
  test(`crnobela screenshots at ${width}px, no console errors, no horizontal scroll`, async ({ page }) => {
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "crnobela");
    // Hide the sticky header/bottom bar so they don't cover the section shots.
    await page.addStyleTag({ content: ".header,.bottombar{visibility:hidden}" });
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager")));
    await page.waitForLoadState("networkidle");
    for (const [name, selector] of SECTIONS) {
      await page.locator(selector).screenshot({ path: `screenshots/crnobela-${name}-${width}.png` });
    }
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    expect(errors).toEqual([]);
  });
}

test("teget build still renders the navy/red theme with the original logo", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`http://localhost:${TEGET_PORT}/`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "teget");
  await expect(page.locator(".header .logo img")).toHaveAttribute("src", "/assets/logo/3d-mdl-wordmark.svg");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(7, 11, 20)");
  const btn = await page.locator(".hero .btn").first().evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
  expect(btn).toEqual(["rgb(255, 255, 255)", "rgb(225, 29, 46)"]);
  expect(await page.locator(".equip img").first().evaluate((el) => getComputedStyle(el).filter)).not.toContain("grayscale");
  await page.locator(".hero").screenshot({ path: "screenshots/teget-hero-1280.png" });
  expect(errors).toEqual([]);
});
