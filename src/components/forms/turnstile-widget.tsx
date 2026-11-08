"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Optional Cloudflare Turnstile widget. Rendered only when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured; no third-party script is
 * loaded otherwise. The token is verified server-side.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

export function TurnstileWidget({ onToken, resetSignal }: { onToken: (token: string) => void; resetSignal: number }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));

  const render = useCallback(() => {
    if (!turnstileSiteKey || !container.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: turnstileSiteKey,
      language: "sl",
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
  }, [onToken]);

  useEffect(() => {
    if (scriptReady) render();
  }, [scriptReady, render]);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current) {
      window.turnstile?.reset(widgetId.current);
      onToken("");
    }
  }, [resetSignal, onToken]);

  useEffect(
    () => () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    },
    [],
  );

  if (!turnstileSiteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={container} className="min-h-[65px]" />
    </>
  );
}
