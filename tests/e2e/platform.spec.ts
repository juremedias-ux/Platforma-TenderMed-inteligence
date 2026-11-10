import { expect, test } from "@playwright/test";

/**
 * Platform routes without a configured database (the e2e server runs with
 * empty Supabase variables). Authenticated journeys need a real Supabase
 * project and are covered by the database tests and the pilot runbook.
 */

const ORG = "00000000-0000-4000-8000-000000000001";

test.describe("platform without configuration", () => {
  test("login page explains that the platform is not configured and is not indexed", async ({ page }) => {
    const response = await page.goto("/prijava");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.getByRole("heading", { name: "Prijava v platformo" })).toBeVisible();
    await expect(page.getByText("platforma še ni konfigurirana")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("organization hub shows the not-configured state", async ({ page }) => {
    const response = await page.goto("/app");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.getByText("Platforma ni konfigurirana")).toBeVisible();
  });

  for (const path of [
    "pregled",
    "oprema",
    "koledar",
    "nastavitve",
    `oprema/${ORG}`,
    "oprema/uvoz",
    "servisi",
    `servisi/${ORG}`,
    "obvestila",
  ]) {
    test(`/app/[org]/${path} never renders organization data without a session`, async ({ page }) => {
      await page.goto(`/app/${ORG}/${path}`);
      await expect(page.getByText(/ni konfigurirana|še ni konfigurirana/).first()).toBeVisible();
      await expect(page.getByRole("table")).toHaveCount(0);
    });
  }

  for (const path of ["/app/servisne-naloge", `/app/servisne-naloge/${ORG}`]) {
    test(`${path} shows the not-configured state`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText("Platforma ni konfigurirana")).toBeVisible();
    });
  }

  test("CSV export and template refuse requests without a session", async ({ request }) => {
    for (const path of ["oprema/izvoz", "oprema/uvoz/predloga"]) {
      const response = await request.get(`/app/${ORG}/${path}`);
      expect(response.status()).toBe(403);
      expect(response.headers()["content-type"]).not.toContain("text/csv");
    }
  });

  test("document downloads refuse requests without a session", async ({ request }) => {
    const response = await request.get(`/app/dokumenti/${ORG}`, { maxRedirects: 0 });
    expect(response.status()).toBe(403);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["location"]).toBeUndefined();
  });

  test("the scheduled job endpoint is closed without a configured secret", async ({ request }) => {
    const response = await request.get("/api/cron/notifications", { headers: { authorization: "Bearer x" } });
    expect(response.status()).toBe(503);
  });

  test("malformed invitation links are handled", async ({ page }) => {
    await page.goto("/povabilo/neveljaven");
    await expect(page.getByText(/Povabilo|konfigurirana/).first()).toBeVisible();
  });
});
