/**
 * E-mail delivery adapter. The only provider implemented is Resend; it is
 * used when RESEND_API_KEY and EMAIL_FROM are configured. Every request
 * carries the outbox row's idempotency key, so a retry after an ambiguous
 * failure (timeout, lost response) does not send a second e-mail.
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}

export type SendResult =
  { kind: "sent"; providerId: string | null } | { kind: "retry"; error: string } | { kind: "failed"; error: string };

export interface EmailAdapter {
  name: string;
  send(email: OutgoingEmail): Promise<SendResult>;
}

export function createResendAdapter(
  config: { apiKey: string; from: string },
  fetchImpl: typeof fetch = fetch,
): EmailAdapter {
  return {
    name: "resend",
    async send(email) {
      let response: Response;
      try {
        response = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": email.idempotencyKey,
          },
          body: JSON.stringify({
            from: config.from,
            to: [email.to],
            subject: email.subject,
            text: email.text,
            html: email.html,
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        // Timeout or network error: the outcome is unknown; retrying with the
        // same idempotency key is safe.
        return { kind: "retry", error: error instanceof Error ? error.name : "network" };
      }
      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { id?: string } | null;
        return { kind: "sent", providerId: body?.id ?? null };
      }
      if (response.status === 429 || response.status >= 500 || response.status === 409) {
        return { kind: "retry", error: `http_${response.status}` };
      }
      return { kind: "failed", error: `http_${response.status}` };
    },
  };
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Builds the e-mail for a notification. Only the title, a short body and a link — never message contents. */
export function renderNotificationEmail(
  notification: { title: string; body: string | null; link_path: string },
  appUrl: string,
): { subject: string; text: string; html: string } {
  const link = `${appUrl}${notification.link_path}`;
  const settings = `${appUrl}/app`;
  const lines = [notification.title];
  if (notification.body) lines.push(notification.body);
  lines.push(`Odprite v platformi: ${link}`);
  lines.push(
    `To sporočilo je poslala platforma TenderMed Intelligence. Obvestila po e-pošti lahko izklopite v platformi (Obvestila → Nastavitve): ${settings}`,
  );
  const text = lines.join("\n\n");
  const html = `<!doctype html><html lang="sl"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
<p style="font-size:16px;font-weight:bold">${escapeHtml(notification.title)}</p>
${notification.body ? `<p>${escapeHtml(notification.body)}</p>` : ""}
<p><a href="${escapeHtml(link)}">Odprite v platformi</a></p>
<p style="font-size:12px;color:#6b7280">To sporočilo je poslala platforma TenderMed Intelligence. Obvestila po e-pošti lahko izklopite v platformi (Obvestila → Nastavitve).</p>
</body></html>`;
  return { subject: notification.title, text, html };
}
