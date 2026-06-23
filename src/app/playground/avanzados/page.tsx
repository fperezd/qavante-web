import { notFound } from "next/navigation";
import { AdvancedDemo } from "./advanced-demo";

/* Demo DEV de los primitivos interactivos avanzados de la Capa 1 (kanban,
   datatable, collapsible, charts). Mismo gate que /playground: oculto (404) en
   prod real; disponible en dev y en e2e (NEXT_PUBLIC_TEST_MODE="playwright").
   Sin `export const runtime` (regla 4). */
export default function AdvancedPlaygroundPage() {
  const hiddenInProd =
    process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_TEST_MODE !== "playwright";

  if (hiddenInProd) notFound();

  return <AdvancedDemo />;
}
