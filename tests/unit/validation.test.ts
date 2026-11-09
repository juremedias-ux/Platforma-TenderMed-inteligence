import { describe, expect, it, vi } from "vitest";
import { LIMITS, contactMessageSchema, demoRequestSchema, toFieldErrors } from "@/lib/validation/inquiry-schemas";
import { readBodyWithLimit, BodyTooLargeError } from "@/lib/security/request-guards";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

describe("pilot sign-up validation (e-mail only)", () => {
  it("accepts only an e-mail address and normalizes it", () => {
    expect(demoRequestSchema.parse({ email: "  ANA@Example.SI " })).toEqual({ email: "ana@example.si" });
  });

  it("requires a valid e-mail address with Slovenian errors", () => {
    const missing = demoRequestSchema.safeParse({});
    expect(missing.success).toBe(false);
    if (!missing.success) expect(toFieldErrors(missing.error).email).toBe("Vpišite e-poštni naslov.");

    const empty = demoRequestSchema.safeParse({ email: "   " });
    expect(empty.success).toBe(false);
    if (!empty.success) expect(toFieldErrors(empty.error).email).toBe("Vpišite e-poštni naslov.");

    const invalid = demoRequestSchema.safeParse({ email: "ni-email" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(toFieldErrors(invalid.error).email).toBe("Vpišite veljaven e-poštni naslov, npr. ime@organizacija.si.");
    }
  });

  it("enforces the e-mail length limit matching the database constraint", () => {
    expect(demoRequestSchema.safeParse({ email: `${"a".repeat(250)}@example.si` }).success).toBe(false);
    expect(LIMITS.emailMax).toBe(254);
  });

  it("drops any other submitted fields", () => {
    const result = demoRequestSchema.parse({
      email: "ana@example.si",
      fullName: "Ana Novak",
      interestArea: "partnership",
      message: "Sporočilo",
      marketingOptIn: true,
    });
    expect(result).toEqual({ email: "ana@example.si" });
  });
});

describe("contact message validation", () => {
  it("requires a message of at least the minimum length, with a Slovenian error", () => {
    const result = contactMessageSchema.safeParse({
      fullName: "Ana Novak",
      email: "ana@example.si",
      message: "Kratko",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).message).toBe(`Vpišite sporočilo (vsaj ${LIMITS.contactMessageMin} znakov).`);
    }
  });

  it("reports missing fields in Slovenian", () => {
    const result = contactMessageSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(errors.fullName).toBe("Vpišite ime in priimek.");
      expect(errors.email).toBe("Vpišite e-poštni naslov.");
      expect(errors.message).toBeDefined();
    }
  });
});

describe("request body limit", () => {
  it("rejects bodies over the limit even without a Content-Length header", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(10_000));
        controller.enqueue(new Uint8Array(10_000));
        controller.close();
      },
    });
    const request = new Request("https://x.test", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readBodyWithLimit(request, 16_384)).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});

describe("Turnstile verification", () => {
  it("returns true only for a successful verification response", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    const rejected = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 }));
    const failing = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await verifyTurnstileToken("s", "token", "203.0.113.7", ok)).toBe(true);
    expect(await verifyTurnstileToken("s", "token", null, rejected)).toBe(false);
    expect(await verifyTurnstileToken("s", "token", null, failing)).toBe(false);
    expect(await verifyTurnstileToken("s", "", null, ok)).toBe(false);
  });
});
