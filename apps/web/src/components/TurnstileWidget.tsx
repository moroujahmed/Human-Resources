"use client";

import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "staffhub-turnstile-script";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onToken);
  useEffect(() => {
    callbackRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !SITE_KEY) return;

    let widgetId: string | undefined;
    let disposed = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const render = () => {
      if (disposed || widgetId || !window.turnstile || !container.isConnected) return;
      widgetId = window.turnstile.render(container, {
        sitekey: SITE_KEY,
        action: "job_application",
        callback: (token) => callbackRef.current(token),
        "error-callback": () => callbackRef.current(""),
        "expired-callback": () => callbackRef.current(""),
      });
      if (interval) clearInterval(interval);
    };

    render();
    if (!widgetId) {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      interval = setInterval(render, 100);
    }

    return () => {
      disposed = true;
      if (interval) clearInterval(interval);
      const script = document.getElementById(SCRIPT_ID);
      script?.removeEventListener("load", render);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  if (!SITE_KEY) return <p role="status">Application verification is not configured. Please contact the site administrator.</p>;
  return <div ref={containerRef} aria-label="Application security verification" />;
}
