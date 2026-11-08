import type { FieldErrors } from "@/lib/validation/inquiry-schemas";

/** Shared response contract between the inquiry route handlers and the forms. */

export type InquiryErrorCode =
  | "invalid_content_type"
  | "forbidden_origin"
  | "payload_too_large"
  | "invalid_json"
  | "validation_failed"
  | "rejected"
  | "verification_failed"
  | "rate_limited"
  | "unavailable"
  | "persistence_failed";

export type InquiryResponseBody = { ok: true } | { ok: false; code: InquiryErrorCode; fieldErrors?: FieldErrors };

/** Name of the hidden honeypot field. Real visitors never see or fill it. */
export const HONEYPOT_FIELD = "website";

/** Slovenian messages shown to visitors for each failure. None claims success. */
export const inquiryErrorMessages: Record<InquiryErrorCode | "network_error", string> = {
  invalid_content_type: "Pošiljanje ni uspelo zaradi nepravilne zahteve. Osvežite stran in poskusite znova.",
  forbidden_origin: "Pošiljanje ni uspelo zaradi nepravilne zahteve. Osvežite stran in poskusite znova.",
  payload_too_large: "Sporočilo je predolgo. Skrajšajte ga in poskusite znova.",
  invalid_json: "Pošiljanje ni uspelo zaradi nepravilne zahteve. Osvežite stran in poskusite znova.",
  validation_failed: "Preverite označena polja in poskusite znova.",
  rejected:
    "Povpraševanja ni bilo mogoče sprejeti. Če ste izpolnili vsa vidna polja, osvežite stran in poskusite znova.",
  verification_failed: "Preverjanje proti zlorabam ni uspelo. Osvežite stran in poskusite znova.",
  rate_limited: "Prejeli smo preveč poskusov v kratkem času. Počakajte nekaj minut in poskusite znova.",
  unavailable:
    "Pošiljanje obrazcev trenutno ni na voljo, zato vaše sporočilo ni bilo shranjeno. Vnesene podatke smo ohranili – poskusite znova pozneje.",
  persistence_failed:
    "Vašega sporočila nam ni uspelo shraniti. Vnesene podatke smo ohranili – poskusite znova čez nekaj trenutkov.",
  network_error:
    "Povezava s strežnikom ni uspela, zato sporočilo ni bilo poslano. Preverite internetno povezavo in poskusite znova.",
};
