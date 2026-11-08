import { expect, test } from "@playwright/test";

test.describe("mobile menu", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("opens, traps focus, closes with Escape and returns focus", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Odpri meni" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Meni" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Za ustanove" })).toBeVisible();

    // Focus stays inside the dialog while tabbing.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("closes after choosing a section link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Odpri meni" }).click();
    await page.getByRole("dialog", { name: "Meni" }).getByRole("link", { name: "Kako deluje" }).click();
    await expect(page.getByRole("dialog", { name: "Meni" })).toBeHidden();
    await expect(page).toHaveURL(/#kako-deluje$/);
  });

  test("offers both primary actions", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Odpri meni" }).click();
    const dialog = page.getByRole("dialog", { name: "Meni" });
    await expect(dialog.getByRole("link", { name: "Oglejte si demo" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Prijavite interes za pilot" })).toBeVisible();
  });
});
