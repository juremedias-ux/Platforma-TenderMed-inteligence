import { expect, test } from "@playwright/test";

/**
 * Homepage motion is progressive enhancement: with reduced motion every
 * element is fully visible and static; the step gallery works with buttons.
 */

test("reduced motion shows all homepage content without animation", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const state = await page.evaluate(() => {
    const animated = [
      ...document.querySelectorAll(".motion-hero-in, .motion-reveal, .motion-reveal-block, .motion-settle, .glow-word"),
    ];
    return {
      count: animated.length,
      notVisible: animated.filter((el) => getComputedStyle(el).opacity !== "1").length,
      animations: animated.filter((el) => getComputedStyle(el).animationName !== "none").length,
    };
  });
  expect(state.count).toBeGreaterThan(20);
  expect(state.notVisible).toBe(0);
  expect(state.animations).toBe(0);
  await context.close();
});

test("the decorative statement word is hidden from assistive technology", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".glow-word")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("heading", { level: 2, name: "Manj razpršenih evidenc. Več preglednosti." })).toHaveCount(
    1,
  );
});

test("step gallery scrolls with the next and previous buttons", async ({ page }) => {
  await page.goto("/");
  const gallery = page.getByRole("list", { name: "Koraki" });
  await gallery.scrollIntoViewIfNeeded();
  const previous = page.getByRole("button", { name: "Prejšnji korak" });
  const next = page.getByRole("button", { name: "Naslednji korak" });
  await expect(previous).toBeDisabled();
  const overflowing = await gallery.evaluate((el) => el.scrollWidth > el.clientWidth + 4);
  test.skip(!overflowing, "All steps fit on this viewport.");
  await next.click();
  await expect.poll(() => gallery.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(previous).toBeEnabled();
});
