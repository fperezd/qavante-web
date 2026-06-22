import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { QavanteLogo } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Layout del wizard de onboarding (registro, verificar, y los pasos post-auth).
   Enfocado: logo arriba, sin sidebar de la app. Gating ÚNICO del wizard acá —
   si el flag `onboarding` está OFF, no hay wizard → al login. Server Component
   (resuelve el flag en runtime del Worker). */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { onboarding } = resolveFeatureFlags();
  if (!onboarding) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-center border-b border-border/40 bg-surface/70 px-4 py-4 backdrop-blur">
        <QavanteLogo variant="hero" alt="Qavante" />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
