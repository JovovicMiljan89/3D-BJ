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

  // Regression check: the open nav must actually be laid out across the
  // viewport (not squished into a sliver by a stray containing-block from
  // an ancestor's backdrop-filter/filter) and its links must be visible.
  const box = await nav.boundingBox();
  expect(box.width).toBeGreaterThan(300);
  expect(box.height).toBeGreaterThan(200);
  await expect(nav.locator("a", { hasText: "Kontakt" })).toBeVisible();

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

test("hero headline and both new sections render", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("3D-MDL | 3D štampa, skeniranje i modelovanje po meri");
  await expect(page.locator("h1")).toHaveText("Od ideje do gotovog predmeta.");
  await expect(page.locator("h1 .accent")).toHaveText("gotovog predmeta.");

  const business = page.locator("#za-firme");
  await expect(business.locator(".tag")).toHaveText("Za firme");
  await expect(business.locator("h2")).toHaveText("Vaš logo, u bojama Vašeg brenda.");
  await expect(business.locator(".checklist li")).toHaveCount(3);

  const spare = page.locator("#rezervni-delovi");
  await expect(spare.locator("h2")).toHaveText("Skeniramo. Ispravljamo. Izrađujemo.");
  await expect(spare.locator(".steps li")).toHaveCount(3);
});

test("the 'Za firme' CTA scrolls to the form without pre-selecting anything", async ({ page }) => {
  await page.goto("/");
  const serviceBefore = await page.locator("#f-service").inputValue();
  await page.locator("#za-firme [data-focus-form]").click();

  await expect(page.locator("#f-name")).toBeFocused({ timeout: 2000 });
  await expect(page.locator("#f-service")).toHaveValue(serviceBefore);
  await expect(page.locator("#f-message")).toHaveValue("");
});

test("'Pošaljite fotografiju dela' prefills service + message and puts the cursor at the end", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pošaljite fotografiju dela" }).click();

  const message = page.locator("#f-message");
  await expect(message).toBeFocused({ timeout: 2000 });
  await expect(message).toHaveValue("Rezervni deo: ");
  await expect(page.locator("#f-service")).toHaveValue("3D skeniranje");
  await expect(page.locator("#kontakt")).toBeInViewport();

  const caret = await message.evaluate((el) => [el.selectionStart, el.selectionEnd, el.value.length]);
  expect(caret).toEqual([14, 14, 14]);

  // Typing continues right after the prefix; clicking again doesn't duplicate it.
  await page.keyboard.type("dugme za veš mašinu");
  await page.getByRole("button", { name: "Pošaljite fotografiju dela" }).click();
  await expect(message).toHaveValue("Rezervni deo: dugme za veš mašinu");
});

for (const width of [375, 1280]) {
  test(`every class used in the page exists in the loaded CSS (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const missing = await page.evaluate(() => {
      const selectorText = [];
      const collect = (rules) => {
        for (const rule of rules) {
          if (rule.selectorText) selectorText.push(rule.selectorText);
          if (rule.cssRules) collect(rule.cssRules);
        }
      };
      for (const sheet of document.styleSheets) collect(sheet.cssRules);
      const defined = new Set(selectorText.join(" ").match(/\.[a-zA-Z_][\w-]*/g).map((c) => c.slice(1)));

      const used = new Set();
      document.querySelectorAll("[class]").forEach((el) => el.classList.forEach((c) => used.add(c)));
      return [...used].filter((c) => !defined.has(c));
    });
    expect(missing).toEqual([]);
  });
}

test("the stylesheet is loaded from a content-hashed file name", async ({ page }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="stylesheet"]').getAttribute("href");
  expect(href).toMatch(/^\/css\/styles\.[0-9a-f]{10}\.css$/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(7, 11, 20)");
});

test("the Web3Forms subject uses the brand name", async ({ page }) => {
  let body = null;
  await page.route("https://api.web3forms.com/submit", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' });
  });
  await page.goto("/");
  await page.locator("#f-name").fill("Petar");
  await page.locator("#f-email").fill("petar@test.rs");
  await page.locator("#f-message").fill("Poruka");
  await page.locator("#inquiryForm button[type=submit]").click();
  await expect(page.locator("#formSuccess")).toBeVisible();
  expect(body.subject).toBe("3D-MDL upit: Petar");
});

test("header logo is the configured wordmark and renders at 40px height", async ({ page }) => {
  await page.goto("/");
  const logo = page.locator(".header .logo img");
  await expect(logo).toHaveAttribute("src", "/assets/logo/3d-mdl-wordmark.svg");
  const box = await logo.boundingBox();
  expect(Math.round(box.height)).toBe(40);
  expect(await logo.evaluate((img) => img.naturalWidth > 0)).toBe(true);
});

test("gallery and equipment photos all load (no broken images)", async ({ page }) => {
  await page.goto("/");
  const imgs = page.locator(".gallery__item img, .equip img");
  await expect(imgs).toHaveCount(7);
  for (const img of await imgs.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});
