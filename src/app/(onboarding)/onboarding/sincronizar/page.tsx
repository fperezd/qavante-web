import { ImportView } from "@/components/onboarding/import-view";

/* `/onboarding/sincronizar` — paso 7 final (post-auth). Trae datos y al finalizar
   completa el onboarding → /inicio. Gating del flag por el layout. */
export default function SincronizarPage() {
  return <ImportView />;
}
