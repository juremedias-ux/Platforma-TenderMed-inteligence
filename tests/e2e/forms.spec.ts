import { expect, test } from "@playwright/test";

const SUCCESS = "Hvala za vaše zanimanje. Vaše povpraševanje smo prejeli.";

test.describe("pilot sign-up form (e-mail only)", () => {
  test("is available at the top of the homepage with a single e-mail field", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("#prijava");
    await expect(hero.getByText("Prijavite interes za pilot")).toBeVisible();
    await expect(hero.getByLabel("E-poštni naslov")).toBeVisible();
    await expect(hero.getByRole("button", { name: "Prijavite interes" })).toBeVisible();
    // Only the e-mail field is visible; the honeypot is hidden from users and assistive technology.
    await expect(hero.getByRole("textbox")).toHaveCount(1);
    await expect(hero.getByRole("radio")).toHaveCount(0);
    await expect(hero.getByRole("checkbox")).toHaveCount(0);
    await expect(hero.getByRole("link", { name: "izjavi o zasebnosti" })).toHaveAttribute("href", "/zasebnost");

    const section = page.locator("#pilot");
    await expect(section.getByRole("textbox")).toHaveCount(1);
    await expect(section.getByLabel("E-poštni naslov")).toBeVisible();
  });

  test("shows a Slovenian validation error, focuses the field and sends nothing", async ({ page }) => {
    let requests = 0;
    await page.route("**/api/demo-request", (route) => {
      requests += 1;
      return route.fulfill({ status: 201, json: { ok: true } });
    });
    await page.goto("/");
    const form = page.locator("#prijava");
    await form.getByRole("button", { name: "Prijavite interes" }).click();
    await expect(form.getByText("Vpišite e-poštni naslov.")).toBeVisible();
    await expect(form.getByLabel("E-poštni naslov")).toBeFocused();
    await expect(form.getByLabel("E-poštni naslov")).toHaveAttribute("aria-invalid", "true");

    await form.getByLabel("E-poštni naslov").fill("ni-email");
    await form.getByRole("button", { name: "Prijavite interes" }).click();
    await expect(form.getByText("Vpišite veljaven e-poštni naslov, npr. ime@organizacija.si.")).toBeVisible();
    expect(requests).toBe(0);
  });

  test("submits once despite repeated clicks and shows success only after confirmation", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.route("**/api/demo-request", async (route) => {
      bodies.push(route.request().postDataJSON());
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ status: 201, json: { ok: true } });
    });
    await page.goto("/");
    const form = page.locator("#prijava");
    await form.getByLabel("E-poštni naslov").fill("ana.novak@example.com");
    await form.getByRole("button", { name: "Prijavite interes" }).click();
    await form
      .locator("button[type=submit]")
      .click({ force: true, noWaitAfter: true })
      .catch(() => undefined);
    await form
      .locator("button[type=submit]")
      .dispatchEvent("click")
      .catch(() => undefined);
    await expect(form.getByRole("button", { name: /Pošiljanje/ })).toBeDisabled();

    await expect(form.getByText(SUCCESS)).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({ email: "ana.novak@example.com", website: "", turnstileToken: "" });
  });

  test("reports the unavailable state honestly when storage is not configured and keeps the input", async ({
    page,
  }) => {
    // The e2e web server runs without Supabase credentials, so the real endpoint returns 503.
    await page.goto("/#pilot");
    const form = page.locator("#pilot");
    await form.getByLabel("E-poštni naslov").fill("ana.novak@example.com");
    await form.getByRole("button", { name: "Prijavite interes" }).click();

    await expect(form.getByRole("alert")).toContainText(
      "Pošiljanje obrazcev trenutno ni na voljo, zato vaše sporočilo ni bilo shranjeno.",
    );
    await expect(form.getByText(SUCCESS)).toHaveCount(0);
    await expect(form.getByLabel("E-poštni naslov")).toHaveValue("ana.novak@example.com");
    await expect(form.getByRole("button", { name: "Prijavite interes" })).toBeEnabled();
  });

  test("shows a retryable network error", async ({ page }) => {
    await page.route("**/api/demo-request", (route) => route.abort("failed"));
    await page.goto("/");
    const form = page.locator("#prijava");
    await form.getByLabel("E-poštni naslov").fill("ana.novak@example.com");
    await form.getByRole("button", { name: "Prijavite interes" }).click();
    await expect(form.getByRole("alert")).toContainText("Povezava s strežnikom ni uspela");
    await page.unroute("**/api/demo-request");
    await page.route("**/api/demo-request", (route) => route.fulfill({ status: 201, json: { ok: true } }));
    await form.getByRole("button", { name: "Prijavite interes" }).click();
    await expect(form.getByText(SUCCESS)).toBeVisible();
  });
});

test.describe("contact form", () => {
  test("submits a message with a mocked successful response", async ({ page }) => {
    await page.route("**/api/contact", (route) => route.fulfill({ status: 201, json: { ok: true } }));
    await page.goto("/#kontakt");
    const form = page.locator("#kontakt");
    await form.getByLabel("Ime in priimek").fill("Marko Kos");
    await form.getByLabel("E-poštni naslov").fill("marko@example.si");
    await form.getByLabel("Sporočilo").fill("Zanima me predstavitev platforme za našo ustanovo.");
    await form.getByRole("button", { name: "Pošlji sporočilo" }).click();
    await expect(form.getByText("Hvala. Vaše sporočilo smo prejeli.")).toBeVisible();
  });

  test("requires a message of minimum length", async ({ page }) => {
    await page.goto("/#kontakt");
    const form = page.locator("#kontakt");
    await form.getByLabel("Ime in priimek").fill("Marko Kos");
    await form.getByLabel("E-poštni naslov").fill("marko@example.si");
    await form.getByLabel("Sporočilo").fill("Kratko");
    await form.getByRole("button", { name: "Pošlji sporočilo" }).click();
    await expect(form.getByText("Vpišite sporočilo (vsaj 10 znakov).")).toBeVisible();
    await expect(form.getByLabel("Sporočilo")).toBeFocused();
  });
});

test.describe("inquiry API", () => {
  test("rejects cross-origin submissions and other methods", async ({ request, baseURL }) => {
    const crossOrigin = await request.post("/api/contact", {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      data: { fullName: "Test Oseba", email: "test@example.com", message: "Dovolj dolgo sporočilo." },
    });
    expect(crossOrigin.status()).toBe(403);

    const sameOrigin = await request.post("/api/contact", {
      headers: { origin: baseURL!, "content-type": "application/json" },
      data: { fullName: "Test Oseba", email: "test@example.com", message: "Dovolj dolgo sporočilo." },
    });
    // No Supabase credentials in the e2e environment: honest 503, never 2xx.
    expect(sameOrigin.status()).toBe(503);
    expect(await sameOrigin.json()).toEqual({ ok: false, code: "unavailable" });

    const get = await request.get("/api/contact");
    expect(get.status()).toBe(405);
  });
});
