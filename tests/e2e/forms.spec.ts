import { expect, test, type Page } from "@playwright/test";

async function fillPilotForm(page: Page) {
  const form = page.locator("#pilot");
  await form.getByLabel("Ime in priimek").fill("Ana Novak");
  await form.getByLabel("E-poštni naslov").fill("ana.novak@example.com");
  await form.getByLabel("Servisi in usklajevanje").check();
  await form.getByLabel(/Kateri izziv želite rešiti/).fill("Usklajevanje servisnih terminov med oddelki.");
  return form;
}

test.describe("pilot inquiry form", () => {
  test("shows Slovenian validation errors, focuses the first invalid field and sends nothing", async ({ page }) => {
    let requests = 0;
    await page.route("**/api/demo-request", (route) => {
      requests += 1;
      return route.fulfill({ status: 201, json: { ok: true } });
    });
    await page.goto("/#pilot");
    const form = page.locator("#pilot");
    await form.getByRole("button", { name: "Pošlji povpraševanje" }).click();

    await expect(form.getByText("Vpišite ime in priimek.")).toBeVisible();
    await expect(form.getByText("Vpišite e-poštni naslov.")).toBeVisible();
    await expect(form.getByText("Izberite, kaj vas najbolj zanima.")).toBeVisible();
    await expect(form.getByLabel("Ime in priimek")).toBeFocused();
    await expect(form.getByLabel("Ime in priimek")).toHaveAttribute("aria-invalid", "true");
    expect(requests).toBe(0);
  });

  test("displays the sensitive-data notice and keeps marketing consent unchecked", async ({ page }) => {
    await page.goto("/#pilot");
    const form = page.locator("#pilot");
    await expect(
      form.getByText("V obrazec ne vpisujte zdravstvenih podatkov pacientov ali drugih občutljivih informacij."),
    ).toBeVisible();
    await expect(form.getByRole("checkbox", { name: /obvestila o razvoju/ })).not.toBeChecked();
    await expect(form.getByRole("link", { name: "izjavi o zasebnosti" })).toHaveAttribute("href", "/zasebnost");
  });

  test("submits once despite repeated clicks and shows success only after confirmation", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.route("**/api/demo-request", async (route) => {
      bodies.push(route.request().postDataJSON());
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ status: 201, json: { ok: true } });
    });
    await page.goto("/#pilot");
    const form = await fillPilotForm(page);
    const submit = form.getByRole("button", { name: "Pošlji povpraševanje" });
    await submit.click();
    // Further clicks during submission must not create additional requests.
    await form
      .locator("button[type=submit]")
      .click({ force: true, noWaitAfter: true })
      .catch(() => undefined);
    await form
      .locator("button[type=submit]")
      .dispatchEvent("click")
      .catch(() => undefined);
    await expect(form.getByRole("button", { name: /Pošiljanje/ })).toBeDisabled();

    await expect(form.getByText("Hvala za vaše zanimanje. Vaše povpraševanje smo prejeli.")).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      fullName: "Ana Novak",
      email: "ana.novak@example.com",
      interestArea: "service_coordination",
      marketingOptIn: false,
      website: "",
    });
  });

  test("reports the unavailable state honestly when storage is not configured and keeps inputs", async ({ page }) => {
    // The e2e web server runs without Supabase credentials, so the real endpoint returns 503.
    await page.goto("/#pilot");
    const form = await fillPilotForm(page);
    await form.getByRole("button", { name: "Pošlji povpraševanje" }).click();

    const alert = form.getByRole("alert");
    await expect(alert).toContainText(
      "Pošiljanje obrazcev trenutno ni na voljo, zato vaše sporočilo ni bilo shranjeno.",
    );
    await expect(form.getByText("Vaše povpraševanje smo prejeli.")).toHaveCount(0);
    await expect(form.getByLabel("Ime in priimek")).toHaveValue("Ana Novak");
    await expect(form.getByLabel("E-poštni naslov")).toHaveValue("ana.novak@example.com");
    await expect(form.getByRole("button", { name: "Pošlji povpraševanje" })).toBeEnabled();
  });

  test("shows a retryable network error", async ({ page }) => {
    await page.route("**/api/demo-request", (route) => route.abort("failed"));
    await page.goto("/#pilot");
    const form = await fillPilotForm(page);
    await form.getByRole("button", { name: "Pošlji povpraševanje" }).click();
    await expect(form.getByRole("alert")).toContainText("Povezava s strežnikom ni uspela");
    await page.unroute("**/api/demo-request");
    await page.route("**/api/demo-request", (route) => route.fulfill({ status: 201, json: { ok: true } }));
    await form.getByRole("button", { name: "Pošlji povpraševanje" }).click();
    await expect(form.getByText("Hvala za vaše zanimanje. Vaše povpraševanje smo prejeli.")).toBeVisible();
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
