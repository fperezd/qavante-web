/* Carga condicional de MSW en browser. Dynamic import asegura que
   el bundle de producción no incluya msw (tree-shaking).

   Activación: NEXT_PUBLIC_API_MOCKING=enabled + NODE_ENV !== 'production'
   (o NEXT_PUBLIC_TEST_MODE="playwright" como override exclusivo para los
   tests E2E que corren contra un build prod local).
   Doble guarda: aunque alguien settee la env var en prod por error, el
   chequeo de NODE_ENV bloquea el inicio del worker (salvo que el override
   E2E esté seteado, lo cual no ocurre nunca en deploy real). Además este
   módulo se importa dinámicamente, así que tampoco entra al bundle de prod. */

export async function initMockServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  const isPlaywrightE2E = process.env.NEXT_PUBLIC_TEST_MODE === "playwright";
  if (process.env.NODE_ENV === "production" && !isPlaywrightE2E) return;
  if (process.env.NEXT_PUBLIC_API_MOCKING !== "enabled") return;

  const { worker } = await import("./browser");
  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: { url: "/mockServiceWorker.js" },
  });

  console.info(
    "[MSW] Mock Service Worker activo. Endpoints mockeados: ver src/test/msw/handlers.ts",
  );
}
