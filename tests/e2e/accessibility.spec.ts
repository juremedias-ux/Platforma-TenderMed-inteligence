import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility checks (axe-core, WCAG 2.1 A/AA rules) for the
 * platform's public entry points. Pages that need a signed-in session are
 * not reachable here; they reuse the same components and form controls.
 */

const pages = [
  { path: "/prijava", name: "prijava" },
  { path: "/pozabljeno-geslo", name: "pozabljeno geslo" },
  { path: "/ponastavitev-gesla", name: "ponastavitev gesla" },
  { path: "/povabilo/neveljaven", name: "povabilo" },
  { path: "/app", name: "aplikacija brez konfiguracije" },
];

for (const { path, name } of pages) {
  test(`${name} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(serious).toEqual([]);
  });
}
