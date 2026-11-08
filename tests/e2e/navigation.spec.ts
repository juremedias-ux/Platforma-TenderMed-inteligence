import { expect, test } from "@playwright/test";

const pages = ["/", "/demo", "/zasebnost", "/pogoji"];

test.describe("public pages", () => {
  test("homepage renders in Slovenian with one H1 and all anchor sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "sl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Vaša oprema, servisi in nove priložnosti. Na enem mestu.",
    );
    for (const id of ["za-ustanove", "kako-deluje", "funkcionalnosti", "za-partnerje", "pilot", "kontakt"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(
      page.getByText("Platforma je v razvoju. Demo prikazuje predvidene delovne tokove z izmišljenimi podatki."),
    ).toBeVisible();
    await expect(page.getByText("Prijava v aplikacijo")).toHaveCount(0);
  });

  test("hero CTA navigates to the demo", async ({ page }) => {
    await page.goto("/");
    await page.locator("#hero-naslov").locator("xpath=..").getByRole("link", { name: "Oglejte si demo" }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole("heading", { level: 1, name: "Interaktivni demo" })).toBeVisible();
    await expect(
      page.getByText(
        "Demonstracijski prikaz z izmišljenimi podatki. Ne vnašajte resničnih osebnih, zdravstvenih ali poslovno zaupnih podatkov.",
      ),
    ).toBeVisible();
  });

  test("module cards deep-link into demo views", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Oglejte si ponazoritvene razpise" }).click();
    await expect(page).toHaveURL(/\/demo\?pogled=razpisi$/);
    await expect(page.getByRole("tab", { name: /Razpisi/ })).toHaveAttribute("aria-selected", "true");
  });

  for (const path of pages) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("demo and draft legal pages are noindex", async ({ page }) => {
    for (const path of ["/demo", "/zasebnost", "/pogoji"]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    }
  });

  test("no placeholder contact links are rendered", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  });

  test("unknown routes show the Slovenian 404 page", async ({ page }) => {
    const response = await page.goto("/ne-obstaja");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Strani ni mogoče najti" })).toBeVisible();
  });

  test("skip link moves focus to the main content", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard flow checked on desktop");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Preskoči na vsebino" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#vsebina$/);
  });
});
