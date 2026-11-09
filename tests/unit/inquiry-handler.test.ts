import { describe, expect, it, vi } from "vitest";
import {
  CONTACT_SOURCE,
  DEMO_REQUEST_SOURCE,
  contactDefinition,
  demoRequestDefinition,
  handleInquiry,
  type InquiryHandlerDependencies,
} from "@/lib/forms/handle-inquiry";
import type {
  ContactMessageRecord,
  DemoRequestRecord,
  InquiryRepository,
  RateLimiter,
} from "@/lib/repositories/inquiry-repository";
import { PersistenceError } from "@/lib/repositories/inquiry-repository";
import { siteConfig } from "@/lib/config/site";

const ORIGIN = "https://tendermed.test";

function makeRequest(
  body: unknown,
  {
    origin = ORIGIN,
    contentType = "application/json",
    raw,
  }: { origin?: string | null; contentType?: string; raw?: string } = {},
) {
  const headers = new Headers({ "content-type": contentType, host: "tendermed.test", "x-forwarded-proto": "https" });
  if (origin) headers.set("origin", origin);
  headers.set("x-forwarded-for", "203.0.113.7, 10.0.0.1");
  return new Request(`${ORIGIN}/api/demo-request`, {
    method: "POST",
    headers,
    body: raw ?? JSON.stringify(body),
  });
}

function memoryBackend(options: { failPersist?: boolean; limit?: number } = {}) {
  const demoRequests: DemoRequestRecord[] = [];
  const contactMessages: ContactMessageRecord[] = [];
  const hits = new Map<string, number>();
  const repository: InquiryRepository = {
    saveDemoRequest: vi.fn(async (record) => {
      if (options.failPersist) throw new PersistenceError("fail", "XX000");
      demoRequests.push(record);
    }),
    saveContactMessage: vi.fn(async (record) => {
      if (options.failPersist) throw new PersistenceError("fail", "XX000");
      contactMessages.push(record);
    }),
  };
  const rateLimiter: RateLimiter = {
    consume: vi.fn(async (bucket, keyHash, limit) => {
      const key = `${bucket}:${keyHash}`;
      const count = (hits.get(key) ?? 0) + 1;
      hits.set(key, count);
      return count <= (options.limit ?? limit);
    }),
  };
  return { repository, rateLimiter, demoRequests, contactMessages };
}

function deps(
  backend: ReturnType<typeof memoryBackend> | null,
  overrides: Partial<InquiryHandlerDependencies> = {},
): InquiryHandlerDependencies {
  return {
    getBackend: () => backend,
    getHashSecret: () => (backend ? "test-secret" : null),
    getTurnstileSecret: () => null,
    verifyTurnstile: vi.fn(async () => true),
    getExtraAllowedOrigins: () => [],
    logger: { warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

const validDemoRequest = {
  email: " Ana.Novak@Example.COM ",
  website: "",
};

describe("inquiry handler – success paths", () => {
  it("stores a valid pilot request with normalized values and returns 201", async () => {
    const backend = memoryBackend();
    const response = await handleInquiry(makeRequest(validDemoRequest), demoRequestDefinition, deps(backend));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backend.demoRequests).toEqual([
      {
        email: "ana.novak@example.com",
        privacyNoticeVersion: siteConfig.privacyNoticeVersion,
        source: DEMO_REQUEST_SOURCE,
      },
    ]);
  });

  it("stores only the e-mail address even if other fields are sent", async () => {
    const backend = memoryBackend();
    await handleInquiry(
      makeRequest({ ...validDemoRequest, fullName: "Ana Novak", message: "Besedilo", marketingOptIn: true }),
      demoRequestDefinition,
      deps(backend),
    );
    expect(backend.demoRequests[0]).toEqual({
      email: "ana.novak@example.com",
      privacyNoticeVersion: siteConfig.privacyNoticeVersion,
      source: DEMO_REQUEST_SOURCE,
    });
  });

  it("stores a contact message", async () => {
    const backend = memoryBackend();
    const response = await handleInquiry(
      makeRequest({ fullName: "Marko Kos", email: "marko@example.si", message: "Zanima me predstavitev platforme." }),
      contactDefinition,
      deps(backend),
    );
    expect(response.status).toBe(201);
    expect(backend.contactMessages[0]).toMatchObject({ email: "marko@example.si", source: CONTACT_SOURCE });
  });

  it("ignores unexpected fields instead of storing them", async () => {
    const backend = memoryBackend();
    await handleInquiry(
      makeRequest({ ...validDemoRequest, role: "admin", privacyNoticeVersion: "forged" }),
      demoRequestDefinition,
      deps(backend),
    );
    expect(backend.demoRequests[0]?.privacyNoticeVersion).toBe(siteConfig.privacyNoticeVersion);
    expect(Object.keys(backend.demoRequests[0] ?? {})).not.toContain("role");
  });
});

describe("inquiry handler – honest failures", () => {
  it("returns 503 and never claims success when Supabase is not configured", async () => {
    const dependencies = deps(null);
    const response = await handleInquiry(makeRequest(validDemoRequest), demoRequestDefinition, dependencies);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "unavailable" });
    expect(dependencies.logger?.error).toHaveBeenCalledWith(expect.stringContaining("not configured"));
  });

  it("returns 500 when persistence fails and logs no personal data", async () => {
    const backend = memoryBackend({ failPersist: true });
    const dependencies = deps(backend);
    const response = await handleInquiry(makeRequest(validDemoRequest), demoRequestDefinition, dependencies);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, code: "persistence_failed" });
    const logged = JSON.stringify(vi.mocked(dependencies.logger!.error).mock.calls);
    expect(logged.toLowerCase()).not.toContain("ana.novak");
  });

  it("returns field errors in Slovenian for invalid input", async () => {
    const backend = memoryBackend();
    const response = await handleInquiry(makeRequest({ email: "ni-email" }), demoRequestDefinition, deps(backend));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("validation_failed");
    expect(body.fieldErrors).toEqual({
      email: "Vpišite veljaven e-poštni naslov, npr. ime@organizacija.si.",
    });
    expect(backend.repository.saveDemoRequest).not.toHaveBeenCalled();
  });
});

describe("inquiry handler – abuse protection", () => {
  it("rejects a filled honeypot without storing anything", async () => {
    const backend = memoryBackend();
    const response = await handleInquiry(
      makeRequest({ ...validDemoRequest, website: "https://spam.example" }),
      demoRequestDefinition,
      deps(backend),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("rejected");
    expect(backend.repository.saveDemoRequest).not.toHaveBeenCalled();
    expect(backend.rateLimiter.consume).not.toHaveBeenCalled();
  });

  it("enforces the durable rate limit and returns Retry-After", async () => {
    const backend = memoryBackend();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await handleInquiry(
        makeRequest({ ...validDemoRequest, email: `oseba${i}@example.com` }),
        demoRequestDefinition,
        deps(backend),
      );
      statuses.push(response.status);
      if (response.status === 429) expect(response.headers.get("retry-after")).toBe("600");
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    expect(backend.demoRequests).toHaveLength(5);
  });

  it("limits repeated submissions for the same e-mail address", async () => {
    const backend = memoryBackend();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const request = makeRequest(validDemoRequest);
      request.headers.set("x-forwarded-for", `198.51.100.${i}`);
      statuses.push((await handleInquiry(request, demoRequestDefinition, deps(backend))).status);
    }
    expect(statuses).toEqual([201, 201, 201, 429]);
  });

  it("hashes identifiers before passing them to the rate limiter", async () => {
    const backend = memoryBackend();
    await handleInquiry(makeRequest(validDemoRequest), demoRequestDefinition, deps(backend));
    const keys = vi.mocked(backend.rateLimiter.consume).mock.calls.map((call) => call[1]);
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toContain("203.0.113.7");
    }
  });

  it("rejects cross-origin and missing-origin requests", async () => {
    const backend = memoryBackend();
    const crossOrigin = await handleInquiry(
      makeRequest(validDemoRequest, { origin: "https://evil.example" }),
      demoRequestDefinition,
      deps(backend),
    );
    expect(crossOrigin.status).toBe(403);
    const noOrigin = await handleInquiry(
      makeRequest(validDemoRequest, { origin: null }),
      demoRequestDefinition,
      deps(backend),
    );
    expect(noOrigin.status).toBe(403);
  });

  it("accepts an explicitly configured additional origin", async () => {
    const backend = memoryBackend();
    const response = await handleInquiry(
      makeRequest(validDemoRequest, { origin: "https://www.tendermed.example" }),
      demoRequestDefinition,
      deps(backend, { getExtraAllowedOrigins: () => ["https://www.tendermed.example"] }),
    );
    expect(response.status).toBe(201);
  });

  it("rejects non-JSON content types, invalid JSON and oversized bodies", async () => {
    const backend = memoryBackend();
    const d = deps(backend);
    expect(
      (await handleInquiry(makeRequest(validDemoRequest, { contentType: "text/plain" }), demoRequestDefinition, d))
        .status,
    ).toBe(415);
    expect((await handleInquiry(makeRequest(null, { raw: "{not json" }), demoRequestDefinition, d)).status).toBe(400);
    expect((await handleInquiry(makeRequest(null, { raw: "[]" }), demoRequestDefinition, d)).status).toBe(400);
    const huge = { ...validDemoRequest, message: "x".repeat(20_000) };
    expect((await handleInquiry(makeRequest(huge), demoRequestDefinition, d)).status).toBe(413);
  });

  it("verifies Turnstile on the server when a secret is configured", async () => {
    const backend = memoryBackend();
    const verifyTurnstile = vi.fn(async (_secret: string, token: string) => token === "valid-token");
    const d = deps(backend, { getTurnstileSecret: () => "turnstile-secret", verifyTurnstile });

    const missing = await handleInquiry(makeRequest(validDemoRequest), demoRequestDefinition, d);
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe("verification_failed");

    const valid = await handleInquiry(
      makeRequest({ ...validDemoRequest, turnstileToken: "valid-token" }),
      demoRequestDefinition,
      d,
    );
    expect(valid.status).toBe(201);
    expect(verifyTurnstile).toHaveBeenLastCalledWith("turnstile-secret", "valid-token", "203.0.113.7");
  });
});
