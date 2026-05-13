/* Carga condicional de MSW en browser. Dynamic import asegura que
   el bundle de producción no incluya msw (tree-shaking).

   Activación: NEXT_PUBLIC_API_MOCKING=enabled + NODE_ENV !== 'production'.
   Doble guarda: aunque alguien settee la env var en prod por error, el
   chequeo de NODE_ENV bloquea el inicio del worker. Además este módulo
   se importa dinámicamente, así que tampoco entra al bundle de prod. */

export async function initMockServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "production") return;
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
