/**
 * Maps database errors to Slovenian messages. Business-rule violations are
 * raised by triggers and functions as `TM_*` codes; everything else gets a
 * neutral message (details are logged server-side without personal data).
 */
const messages: Record<string, string> = {
  TM_NOT_AUTHENTICATED: "Za to dejanje se morate prijaviti.",
  TM_MEMBERSHIP_IMMUTABLE: "Članstva ni mogoče prenesti v drugo organizacijo.",
  TM_MEMBERSHIP_SELF_CHANGE: "Svoje vloge ne morete spremeniti sami.",
  TM_MEMBERSHIP_OWNER_ONLY: "Lastnike lahko upravlja samo lastnik organizacije.",
  TM_LAST_OWNER: "Organizacija mora imeti vsaj enega lastnika.",
  TM_INVITATION_ROLE_TOO_HIGH: "Ne morete povabiti uporabnika z višjo vlogo od svoje.",
  TM_INVITATION_IMMUTABLE: "Povabila ni mogoče urejati, lahko ga le prekličete.",
  TM_INVITATION_CLOSED: "Povabilo je že sprejeto ali preklicano.",
  TM_INVITATION_NOT_FOUND: "Povabilo ne obstaja.",
  TM_INVITATION_REVOKED: "Povabilo je bilo preklicano.",
  TM_INVITATION_USED: "Povabilo je že bilo uporabljeno.",
  TM_INVITATION_EXPIRED: "Povabilo je poteklo. Prosite pošiljatelja za novo povabilo.",
  TM_INVITATION_EMAIL_MISMATCH: "Povabilo je namenjeno drugemu e-poštnemu naslovu.",
  TM_EMAIL_NOT_VERIFIED: "E-poštni naslov vašega računa še ni potrjen.",
  TM_NOT_SUPPORTED: "To dejanje trenutno ni podprto.",
  TM_VERSION_CONFLICT: "Podatke je medtem spremenil nekdo drug. Osvežite stran in poskusite znova.",
};

export function businessErrorCode(error: unknown): string | null {
  const text = error && typeof error === "object" && "message" in error ? String(error.message) : String(error ?? "");
  const match = /TM_[A-Z_]+/.exec(text);
  return match ? match[0] : null;
}

export function dbErrorMessage(error: unknown, fallback = "Dejanja ni bilo mogoče izvesti. Poskusite znova."): string {
  const code = businessErrorCode(error);
  if (code && messages[code]) return messages[code];
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "42501") return "Za to dejanje nimate dovoljenja.";
    if (error.code === "23505") return "Zapis s temi podatki že obstaja.";
    if (error.code === "23514" || error.code === "22P02" || error.code === "23502") {
      return "Vneseni podatki niso veljavni.";
    }
  }
  return fallback;
}

export function registerErrorMessages(extra: Record<string, string>): void {
  Object.assign(messages, extra);
}
