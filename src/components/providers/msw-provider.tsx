"use client";

/* Wrapper client-only que arranca MSW en el navegador cuando
   NEXT_PUBLIC_API_MOCKING=enabled. Render-blocking hasta que el worker
   esté listo, así no hay race condition de requests sin interceptar al
   primer render (típico bug de "primer fetch escapa a MSW").

   Activación: requiere las dos vars de abajo (defensa en profundidad,
   ADR-0005). NEXT_PUBLIC_TEST_MODE="playwright" es el override exclusivo
   para Playwright (cuyo build de webServer usa npm run build → NODE_ENV=
   production); solo se setea desde webServer.env, nunca en prod real. */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const IS_PLAYWRIGHT_E2E = process.env.NEXT_PUBLIC_TEST_MODE === "playwright";
const MOCKING_ENABLED =
  process.env.NEXT_PUBLIC_API_MOCKING === "enabled" &&
  (process.env.NODE_ENV !== "production" || IS_PLAYWRIGHT_E2E);

export function MswProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!MOCKING_ENABLED);

  useEffect(() => {
    if (!MOCKING_ENABLED) return;
    let cancelled = false;
    import("@/test/msw/init-browser")
      .then(({ initMockServiceWorker }) => initMockServiceWorker())
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        console.error("[MSW] Falló inicialización:", err);
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
