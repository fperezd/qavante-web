import { notFound } from "next/navigation";
import { PlaygroundDemo } from "./playground-demo";

/* Playground del Sistema de Diseño Qavante (C0-06/07/10) — herramienta de DEV,
   no producto: demo de tokens + componentes capa 1 + ping al backend.

   Server Component que la OCULTA (404) en prod real, para no exponer superficie
   innecesaria en `app.qavante.com` (hallazgo #7 del 360). Sigue disponible:
   - en `npm run dev` (NODE_ENV !== "production"), y
   - en los e2e de Playwright, que la cubren como ruta pública — el build de e2e
     setea NEXT_PUBLIC_TEST_MODE="playwright" (playwright.config.ts), var que
     solo existe ahí; nunca en el build de prod de Cloudflare.
   Sin `export const runtime` (regla 4). */
export default function PlaygroundPage() {
  const hiddenInProd =
    process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_TEST_MODE !== "playwright";

  if (hiddenInProd) notFound();

  return <PlaygroundDemo />;
}
