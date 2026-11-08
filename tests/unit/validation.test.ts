import { describe, expect, it, vi } from "vitest";
import { LIMITS, contactMessageSchema, demoRequestSchema, toFieldErrors } from "@/lib/validation/inquiry-schemas";
import { readBodyWithLimit, BodyTooLargeError } from "@/lib/security/request-guards";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

describe("demo request validation", () => {
  const valid = { fullName: "Ana Novak", email: "ana@example.si", interestArea: "partnership" };

  it("accepts the minimal required fields and defaults optional values", () => {
    const result = demoRequestSchema.parse(valid);
    expect(result).toEqual({ ...valid, message: null, marketingOptIn: false });
  });

  it("normalizes whitespace and e-mail case", () => {
    const result = demoRequestSchema.parse({
      ...valid,
      fullName: "  Ana \n  Novak  ",
      email: "  ANA@Example.SI ",
      message: "  Vrstica 1\r\n\r\n\r\n\r\nVrstica 2  ",
    });
    expect(result.fullName).toBe("Ana Novak");
    expect(result.email).toBe("ana@example.si");
    expect(result.message).toBe("Vrstica 1\n\nVrstica 2");
  });

  it("does not require company, phone, job title or role", () => {
    expect(demoRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces length limits matching the database constraints", () => {
    expect(demoRequestSchema.safeParse({ ...valid, fullName: "A" }).success).toBe(false);
    expect(demoRequestSchema.safeParse({ ...valid, fullName: "A".repeat(LIMITS.fullNameMax + 1) }).success).toBe(false);
    expect(demoRequestSchema.safeParse({ ...valid, message: "x".repeat(LIMITS.demoMessageMax) }).success).toBe(true);
    expect(demoRequestSchema.safeParse({ ...valid, message: "x".repeat(LIMITS.demoMessageMax + 1) }).success).toBe(
      false,
    );
    expect(demoRequestSchema.safeParse({ ...valid, email: `${"a".repeat(250)}@example.si` }).success).toBe(false);
  });

  it("stores an empty or whitespace-only optional message as null", () => {
    expect(demoRequestSchema.parse({ ...valid, message: "   \n " }).message).toBeNull();
    expect(demoRequestSchema.parse({ ...valid, message: null }).message).toBeNull();
  });

  it("rejects unknown interest areas and control characters", () => {
    expect(demoRequestSchema.safeParse({ ...valid, interestArea: "pricing" }).success).toBe(false);
    expect(demoRequestSchema.safeParse({ ...valid, fullName: "Ana\u0007Novak" }).success).toBe(false);
  });

  it("rejects a non-boolean marketing consent value", () => {
    expect(demoRequestSchema.safeParse({ ...valid, marketingOptIn: "true" }).success).toBe(false);
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
