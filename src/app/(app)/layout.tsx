import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { OnboardingGuard } from "@/components/onboarding/onboarding-guard";
import { UserRutGuard } from "@/components/onboarding/user-rut-guard";
import { PendingConnectionsBanner } from "@/components/onboarding/pending-connections-banner";
import { AppProviders } from "@/components/providers/app-providers";
import { auth } from "@/lib/auth/session";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* (app)/layout.tsx es server component — llama auth() (que lee la cookie con
   next/headers) y pasa el role al shell para gating del sidebar. Si auth()
   devuelve null el middleware ya redirigió a /login antes de llegar acá,
   pero defensa-en-profundidad: fallback a undefined → sidebar oculta
   Administración (default seguro). Resuelve `assistant` acá (server) para
   gatear el Asistente — el flag se lee en runtime del Worker (no client). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const {
    assistant,
    onboarding,
    onboardingBanner,
    syncStatus,
    decisionBrief,
    remuneraciones,
    bancoScreen,
    bandejaV07,
    presupuesto,
    financiamientoV13,
    simuladorV14,
    financialAgreements,
  } = resolveFeatureFlags();
  return (
    <AppProviders>
      <AppShell
        userRole={session?.user.role}
        assistantEnabled={assistant}
        syncStatusEnabled={syncStatus}
        decisionBriefEnabled={decisionBrief}
        remuneracionesEnabled={remuneraciones}
        bancoEnabled={bancoScreen}
        bandejaEnabled={bandejaV07}
        presupuestoEnabled={presupuesto}
        financiamientoEnabled={financiamientoV13}
        simuladorEnabled={simuladorV14}
        acuerdosEnabled={financialAgreements}
      >
        {/* Gated por `onboarding` — ⚠️ ON en prod (`wrangler.toml`), no es un flag
          oscuro. Si el tenant no completó onboarding redirige al wizard, y solo
          con dato presente, fresco y `completed:false`. Fail-safe (ver el componente). */}
        {onboarding && <UserRutGuard />}
        {onboarding && <OnboardingGuard />}
        {/* Entrada visible para retomar una conexión diferida ("conectar después").
          Flag PROPIO (`onboardingBanner`, OFF): alcanza a todos los tenants
          existentes, no solo a los que se registran — ver el componente. */}
        {onboardingBanner && <PendingConnectionsBanner />}
        {children}
      </AppShell>
    </AppProviders>
  );
}
