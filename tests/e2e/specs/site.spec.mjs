import { test, expect } from "@playwright/test";

test("page loads with no console errors", async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();

  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
});

test("hamburger menu opens and closes the mobile nav", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");

  const toggle = page.locator("#navToggle");
  const nav = page.locator("#siteNav");

  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav).not.toHaveClass(/is-open/);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(nav).toHaveClass(/is-open/);

  // Closes on Escape.
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav).not.toHaveClass(/is-open/);

  // Closes on link click too.
  await toggle.click();
  await expect(nav).toHaveClass(/is-open/);
  await nav.locator("a").first().click();
  await expect(nav).not.toHaveClass(/is-open/);
});

test("bottom bar is visible at 375px and hidden at 1280px", async ({ page }) => {
  await page.goto("/");

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.locator(".bottombar")).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".bottombar")).toBeHidden();
});

test("a CTA scrolls to the contact form and focuses the name field", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-focus-form]").first().click();

  await expect(page.locator("#f-name")).toBeFocused({ timeout: 2000 });
  await expect(page.locator("#kontakt")).toBeInViewport();
});

test("submitting the empty inquiry form shows a validation error", async ({ page }) => {
  await page.goto("/");

  const formError = page.locator("#formError");
  await expect(formError).toBeHidden();

  await page.locator("#inquiryForm button[type=submit]").click();
  await expect(formError).toBeVisible();
});

test("a valid submission posts to Web3Forms (including file_link) and shows the success message", async ({ page }) => {
  let requestBody = null;
  await page.route("https://api.web3forms.com/submit", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "ok" }),
    });
  });

  await page.goto("/");
  await page.locator('#inquiryForm input[name="name"]').fill("Test Person");
  await page.locator('#inquiryForm input[name="email"]').fill("test@example.com");
  await page.locator('#inquiryForm input[name="file_link"]').fill("https://drive.example/my-model.stl");
  await page.locator('#inquiryForm textarea[name="message"]').fill("Playwright smoke test message.");
  await page.locator("#inquiryForm button[type=submit]").click();

  await expect(page.locator("#formSuccess")).toBeVisible();
  expect(requestBody).not.toBeNull();
  expect(requestBody.name).toBe("Test Person");
  expect(requestBody.email).toBe("test@example.com");
  expect(requestBody.file_link).toBe("https://drive.example/my-model.stl");
});

test("FAQ items toggle open/closed, first one open by default", async ({ page }) => {
  await page.goto("/");
  const items = page.locator(".faq__item");
  const first = items.first();
  const second = items.nth(1);

  await expect(first).toHaveJSProperty("open", true);
  await expect(second).toHaveJSProperty("open", false);

  await second.locator("summary").click();
  await expect(second).toHaveJSProperty("open", true);
});

test("no horizontal scroll at 375px viewport width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("gallery lightbox opens with the Enter key and shows the right caption", async ({ page }) => {
  await page.goto("/");
  const firstItem = page.locator(".gallery__item").first();
  const caption = await firstItem.locator("figcaption").textContent();

  await firstItem.focus();
  await page.keyboard.press("Enter");

  const lightbox = page.locator(".modal--image");
  await expect(lightbox).toHaveClass(/is-open/);
  await expect(lightbox.locator("p")).toHaveText(caption.trim());

  // Escape closes it and returns focus to the triggering gallery item.
  await page.keyboard.press("Escape");
  await expect(lightbox).not.toHaveClass(/is-open/);
  await expect(firstItem).toBeFocused();
});

test("no leftover placeholder text (\"0 din\" or \"example\") anywhere on the page", async ({ page }) => {
  await page.goto("/");
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/0\s*din/i);
  expect(bodyText.toLowerCase()).not.toContain("example");
});
