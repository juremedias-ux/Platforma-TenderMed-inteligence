import { expect, test, type Page } from "@playwright/test";

async function overviewValue(page: Page, label: string) {
  const tile = page.getByRole("button", { name: new RegExp(`^${label}`) });
  return (await tile.locator("[data-overview-value]").textContent())?.trim();
}

test.describe("interactive demo", () => {
  test.skip(({ isMobile }) => isMobile, "detailed demo flows run on desktop; mobile smoke test below");

  test("overview counts come from the dataset", async ({ page }) => {
    await page.goto("/demo");
    expect(await overviewValue(page, "Naprave v evidenci")).toBe("12");
    expect(await overviewValue(page, "Zamujene aktivnosti")).toBe("3");
    expect(await overviewValue(page, "Aktivnosti v naslednjih 30 dneh")).toBe("4");
    expect(await overviewValue(page, "Odprti servisni zahtevki")).toBe("3");
    expect(await overviewValue(page, "Priporočila za pregled")).toBe("4");
  });

  test("homepage preview shows the same counts as the demo", async ({ page }) => {
    await page.goto("/");
    const preview = page.getByRole("figure", { name: "Predogled demo vmesnika z izmišljenimi podatki" });
    await expect(preview.getByText("Demo · izmišljeni podatki")).toBeVisible();
    const stats = await preview.locator("dl > div").allTextContents();
    expect(stats.map((s) => s.replace(/\s+/g, " ").trim())).toEqual([
      "Naprave12",
      "Zamujene aktivnosti3",
      "V naslednjih 30 dneh4",
      "Odprti zahtevki3",
    ]);
  });

  test("filters the equipment register", async ({ page }) => {
    await page.goto("/demo?pogled=oprema");
    const table = page.getByRole("table", { name: "Evidenca opreme (izmišljeni podatki)" });
    await expect(table.locator("tbody tr")).toHaveCount(12);

    await page.getByLabel("Iskanje").fill("crpalka");
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByText("Prikaz: 2 od 12 naprav")).toBeVisible();

    await page.getByLabel("Iskanje").fill("");
    await page.getByLabel("Servisno stanje").selectOption("overdue");
    await expect(table.locator("tbody tr")).toHaveCount(3);
    await page.getByLabel("Lokacija").selectOption({ label: "Fizioterapija" });
    await expect(table.locator("tbody tr")).toHaveCount(1);

    await page.getByLabel("Kategorija").selectOption({ label: "Laboratorijska oprema" });
    await expect(page.getByText("Ni naprav, ki ustrezajo izbranim filtrom.")).toBeVisible();
    await page.getByRole("button", { name: "Počisti filtre" }).first().click();
    await expect(table.locator("tbody tr")).toHaveCount(12);
  });

  test("equipment details open in an accessible drawer without fake downloads", async ({ page }) => {
    await page.goto("/demo?pogled=oprema");
    const trigger = page.getByRole("button", { name: /Podrobnosti: Infuzijska črpalka IP-3, IP3-17-20931/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog", { name: "Infuzijska črpalka IP-3" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Serijska številka")).toBeVisible();
    await expect(drawer.getByText("Servisni načrt")).toBeVisible();
    await expect(drawer.getByText("Navodila za uporabo IP-3").first()).toBeVisible();
    await expect(drawer.locator("a[download], a[href$='.pdf']")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("creates and coordinates a service request, with completion recorded separately", async ({ page }) => {
    await page.goto("/demo?pogled=servisi");
    await page.getByRole("button", { name: "Nov servisni zahtevek" }).click();
    const dialog = page.getByRole("dialog", { name: "Nov servisni zahtevek" });
    await dialog.getByRole("button", { name: "Ustvari zahtevek" }).click();
    await expect(dialog.getByText("Izberite napravo.")).toBeVisible();

    await dialog.getByLabel("Naprava").selectOption({ label: "Terapevtski ultrazvok TU-2 · TU2-20-01568" });
    await dialog.getByLabel("Vrsta težave").selectOption({ label: "Redno vzdrževanje ali pregled" });
    await dialog.getByLabel("Med servisom potrebujemo nadomestno opremo").check();
    await dialog.getByRole("button", { name: "Ustvari zahtevek" }).click();
    await expect(dialog).toBeHidden();

    const tab = page.getByRole("tab", { name: /Servisi/ });
    await expect(tab).toContainText("4");
    const detail = page
      .getByRole("heading", { level: 3, name: "Terapevtski ultrazvok TU-2" })
      .locator("xpath=ancestor::div[contains(@class,'space-y-4')][1]");
    await expect(detail.getByText("Še ni potrjen")).toBeVisible();

    // Confirmation is not possible before a date is proposed.
    await expect(detail.getByRole("button", { name: "Potrdi predlagani termin" })).toBeDisabled();
    const statusSelect = detail.getByLabel("Spremeni status");
    await expect(statusSelect.locator("option", { hasText: "Termin potrjen" })).toBeDisabled();

    const proposed = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 10);
      return d.toISOString().slice(0, 10);
    });
    await detail.getByLabel("Predlagaj nov termin").fill(proposed);
    await detail.getByRole("button", { name: "Predlagaj" }).click();
    await expect(detail.getByText("V usklajevanju").first()).toBeVisible();
    await detail.getByRole("button", { name: "Potrdi predlagani termin" }).click();
    await expect(detail.getByText("Termin potrjen").first()).toBeVisible();

    await statusSelect.selectOption("closed");
    await expect(detail.getByText("Zahtevek je zaključen, izvedba vzdrževanja pa ni zabeležena.")).toBeVisible();

    await detail.getByRole("button", { name: "Zabeleži izvedbo" }).click();
    const completion = page.getByRole("dialog", { name: "Zabeleži izvedbo vzdrževanja" });
    await completion.getByLabel("Kalibracija (po servisnem načrtu)").check();
    await completion.getByRole("button", { name: "Zabeleži izvedbo" }).click();
    await expect(completion).toBeHidden();
    await expect(detail.getByText("Zabeleženo")).toBeVisible();

    // The overdue calibration is now recorded, so overdue activities drop from 3 to 2.
    await page.getByRole("tab", { name: /Pregled/ }).click();
    expect(await overviewValue(page, "Zamujene aktivnosti")).toBe("2");
  });

  test("recommendation actions and explanation", async ({ page }) => {
    await page.goto("/demo?pogled=priporocila");
    await expect(page.getByText("Plačana predstavitev").first()).toBeVisible();
    const card = page.getByRole("article", { name: "Sistem za spremljanje uporabe opreme Zeta Link" });
    await expect(card.getByText("Premalo podatkov")).toBeVisible();
    await card.getByRole("button", { name: "Ni relevantno" }).click();
    await expect(page.getByRole("button", { name: /Za pregled \(3\)/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Priporočila/ })).toContainText("3");

    const accessory = page.getByRole("article", { name: "Akumulatorski modul BP-20" });
    await accessory.getByRole("button", { name: "Shrani za pregled" }).click();
    await expect(accessory.getByRole("button", { name: "Shranjeno za pregled" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await accessory.getByRole("button", { name: "Zakaj ta predlog?" }).click();
    const dialog = page.getByRole("dialog", { name: /Zakaj ta predlog\? Akumulatorski modul BP-20/ });
    await expect(dialog.getByText("Zakaj je predlog relevanten")).toBeVisible();
    await expect(dialog.getByText("Komercialna povezava ponudnika")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("tenders are clearly illustrative", async ({ page }) => {
    await page.goto("/demo?pogled=razpisi");
    await expect(page.getByText("Povezava z živimi razpisnimi viri v tej različici ni vzpostavljena.")).toBeVisible();
    await expect(page.getByText("Ponazoritveni razpis — ni dejanska objava.")).toHaveCount(3);
    await expect(page.getByText("Primerno za nadaljnji pregled")).toHaveCount(1);
    await expect(page.getByText("Potreben dodaten pregled")).toHaveCount(2);
    await expect(page.locator("main a[href^='http']")).toHaveCount(0);
  });

  test("reset restores the initial demo state", async ({ page }) => {
    await page.goto("/demo?pogled=priporocila");
    await page.getByRole("button", { name: "Ni relevantno", exact: true }).first().click();
    await expect(page.getByRole("tab", { name: /Priporočila/ })).toContainText("3");
    await page.getByRole("button", { name: "Ponastavi demo" }).click();
    await expect(page.getByRole("tab", { name: /Priporočila/ })).toContainText("4");
  });

  test("demo tabs support arrow-key navigation", async ({ page }) => {
    await page.goto("/demo");
    const overview = page.getByRole("tab", { name: /Pregled/ });
    await overview.focus();
    await page.keyboard.press("ArrowDown");
    const equipment = page.getByRole("tab", { name: /Oprema/ });
    await expect(equipment).toBeFocused();
    await expect(equipment).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/pogled=oprema/);
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: /Razpisi/ })).toHaveAttribute("aria-selected", "true");
  });

  test("demo interactions are not sent to the server or stored in the browser", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") posts.push(request.url());
    });
    await page.goto("/demo?pogled=priporocila");
    await page.getByRole("button", { name: "Shrani za pregled", exact: true }).first().click();
    await page.getByRole("tab", { name: /Servisi/ }).click();
    await page.getByRole("button", { name: "Nov servisni zahtevek" }).click();
    const dialog = page.getByRole("dialog", { name: "Nov servisni zahtevek" });
    await dialog.getByLabel("Naprava").selectOption({ index: 1 });
    await dialog.getByLabel("Vrsta težave").selectOption({ index: 1 });
    await dialog.getByRole("button", { name: "Ustvari zahtevek" }).click();
    const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
    expect(storage).toEqual({ local: 0, session: 0 });
    expect(posts).toEqual([]);
  });
});

test.describe("interactive demo on mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("uses cards instead of the table and opens details", async ({ page }) => {
    await page.goto("/demo?pogled=oprema");
    await expect(page.getByRole("table")).toBeHidden();
    const list = page.getByRole("list", { name: "Evidenca opreme (izmišljeni podatki)" });
    await expect(list.getByRole("listitem")).toHaveCount(12);
    await list.getByRole("button", { name: /Podrobnosti: Defibrilator DF-10/ }).click();
    await expect(page.getByRole("dialog", { name: "Defibrilator DF-10" })).toBeVisible();
  });
});
