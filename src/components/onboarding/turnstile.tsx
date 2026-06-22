"use client";

import * as React from "react";

/* Widget de Cloudflare Turnstile (anti-bot del signup). Carga el script de CF
   una sola vez y renderiza explícitamente; emite el token por `onVerify`. La
   site key es pública (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`); la secret la valida el
   backend. Sin key configurada → no renderiza (fail-safe en dev/test). */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  remove: (id: string) => void;
  reset: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar Turnstile"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface TurnstileProps {
  onVerify: (token: string) => void;
  /** Se llama cuando el token expira o falla → el padre debe limpiarlo. */
  onExpire?: () => void;
  className?: string;
}

export function Turnstile({ onVerify, onExpire, className }: TurnstileProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | null>(null);
  /* Mantener los callbacks frescos sin re-montar el widget. */
  const cbs = React.useRef({ onVerify, onExpire });
  cbs.current = { onVerify, onExpire };

  React.useEffect(() => {
    if (!SITE_KEY) return undefined;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (token) => cbs.current.onVerify(token),
          "expired-callback": () => cbs.current.onExpire?.(),
          "error-callback": () => cbs.current.onExpire?.(),
        });
      })
      .catch(() => {
        /* Script no cargó (offline / bloqueado): el padre deja el submit
           deshabilitado por falta de token. No rompemos la pantalla. */
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* widget ya removido */
        }
        widgetId.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) {
    return (
      <p className="text-xs text-neutral-mid">
        Verificación anti-bot no configurada en este entorno.
      </p>
    );
  }
  return <div ref={ref} className={className} />;
}
