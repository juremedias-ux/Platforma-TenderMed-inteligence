"use client";

import { useCallback, useRef, useState } from "react";
import { inquiryErrorMessages, type InquiryResponseBody } from "@/lib/forms/inquiry-response";
import type { FieldErrors } from "@/lib/validation/inquiry-schemas";

export type SubmissionStatus = "idle" | "submitting" | "success" | "error";

/**
 * Submits an inquiry to a route handler. A second submission is ignored
 * while one is in flight (duplicate-click protection independent of the
 * disabled button). Success is reported only when the server confirms
 * persistence with `{ ok: true }`.
 */
export function useInquirySubmission(endpoint: string) {
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<FieldErrors>({});
  const inFlight = useRef(false);

  const submit = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setStatus("submitting");
      setErrorMessage(null);
      setServerFieldErrors({});

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        let body: InquiryResponseBody | null = null;
        try {
          body = (await response.json()) as InquiryResponseBody;
        } catch {
          body = null;
        }

        if (response.ok && body?.ok === true) {
          setStatus("success");
          return true;
        }

        const code =
          body && body.ok === false ? body.code : response.status === 503 ? "unavailable" : "persistence_failed";
        setServerFieldErrors(body && body.ok === false && body.fieldErrors ? body.fieldErrors : {});
        setErrorMessage(inquiryErrorMessages[code]);
        setStatus("error");
        return false;
      } catch {
        setErrorMessage(inquiryErrorMessages.network_error);
        setStatus("error");
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [endpoint],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setServerFieldErrors({});
  }, []);

  return { status, errorMessage, serverFieldErrors, submit, reset };
}
