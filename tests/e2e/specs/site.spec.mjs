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

test("every [data-open-contact] button opens the contact modal", async ({ page }) => {
  await page.goto("/");
  const modal = page.locator("#contactModal");
  const triggers = page.locator("[data-open-contact]");
  const count = await triggers.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    await triggers.nth(i).click();
    await expect(modal).toHaveClass(/is-open/);
    await expect(modal).toHaveAttribute("aria-hidden", "false");
    await page.keyboard.press("Escape");
    await expect(modal).not.toHaveClass(/is-open/);
  }
});

test("submitting the empty inquiry form shows a validation error", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-open-contact]").first().click();

  const formError = page.locator("#formError");
  await expect(formError).toBeHidden();

  await page.locator("#inquiryForm button[type=submit]").click();
  await expect(formError).toBeVisible();
});

test("a valid submission posts to Web3Forms and shows the success message", async ({ page }) => {
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
  await page.locator("[data-open-contact]").first().click();

  await page.locator('#inquiryForm input[name="name"]').fill("Test Person");
  await page.locator('#inquiryForm input[name="email"]').fill("test@example.com");
  await page.locator('#inquiryForm textarea[name="message"]').fill("Playwright smoke test message.");
  await page.locator("#inquiryForm button[type=submit]").click();

  await expect(page.locator("#formSuccess")).toBeVisible();
  expect(requestBody).not.toBeNull();
  expect(requestBody.name).toBe("Test Person");
  expect(requestBody.email).toBe("test@example.com");
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

test("clicking a gallery image opens the lightbox with its caption", async ({ page }) => {
  await page.goto("/");
  const firstItem = page.locator(".gallery__item").first();
  const caption = await firstItem.locator("figcaption").textContent();

  await firstItem.click();

  const lightbox = page.locator(".modal--image");
  await expect(lightbox).toHaveClass(/is-open/);
  await expect(lightbox.locator("p")).toHaveText(caption.trim());
});
