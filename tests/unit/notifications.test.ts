import { describe, expect, it, vi } from "vitest";
import { createResendAdapter, renderNotificationEmail } from "@/lib/notifications/email";

const email = { to: "a@example.si", subject: "S", text: "T", html: "<p>T</p>", idempotencyKey: "key-1" };

describe("Resend adapter", () => {
  it("sends with the idempotency key and returns the provider id", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_123" }), { status: 200 }));
    const adapter = createResendAdapter({ apiKey: "test-key", from: "TenderMed <x@example.si>" }, fetchMock);
    expect(await adapter.send(email)).toEqual({ kind: "sent", providerId: "re_123" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-1");
    expect(JSON.parse(String(init.body))).toMatchObject({ to: ["a@example.si"], from: "TenderMed <x@example.si>" });
  });

  it("classifies failures: network and 429/5xx/409 are retried, other 4xx fail", async () => {
    const adapterFor = (impl: () => Promise<Response>) => createResendAdapter({ apiKey: "k", from: "f" }, vi.fn(impl));
    expect((await adapterFor(() => Promise.reject(new TypeError("fetch failed"))).send(email)).kind).toBe("retry");
    for (const status of [409, 429, 500, 503]) {
      expect((await adapterFor(async () => new Response("", { status })).send(email)).kind).toBe("retry");
    }
    for (const status of [400, 401, 403, 422]) {
      expect((await adapterFor(async () => new Response("", { status })).send(email)).kind).toBe("failed");
    }
  });
});

describe("notification e-mail", () => {
  it("contains the title, body and absolute link, with HTML escaped", () => {
    const rendered = renderNotificationEmail(
      { title: "Rok čez 7 dni: <Kalibracija>", body: "Rok: 17. 11. 2026.", link_path: "/app/abc/oprema/def" },
      "https://platforma.example.si",
    );
    expect(rendered.subject).toBe("Rok čez 7 dni: <Kalibracija>");
    expect(rendered.text).toContain("https://platforma.example.si/app/abc/oprema/def");
    expect(rendered.html).toContain("&lt;Kalibracija&gt;");
    expect(rendered.html).not.toContain("<Kalibracija>");
  });
});

describe("cron endpoint", () => {
  it("refuses requests without the configured secret", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { GET } = await import("@/app/api/cron/notifications/route");

    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("http://localhost/api/cron/notifications"))).status).toBe(503);

    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect((await GET(new Request("http://localhost/api/cron/notifications"))).status).toBe(401);
    const wrong = new Request("http://localhost/api/cron/notifications", { headers: { authorization: "Bearer nope" } });
    expect((await GET(wrong)).status).toBe(401);
    const right = new Request("http://localhost/api/cron/notifications", {
      headers: { authorization: "Bearer s3cret-value" },
    });
    const response = await GET(right);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "backend_not_configured" });
  });
});
