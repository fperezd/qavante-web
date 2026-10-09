"use client";

import { useRouter } from "next/navigation";
import { CurrencySettingsView } from "@/components/monedas/currency-settings-view";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";
import { useOnboardingBack } from "./use-onboarding-back";

/* Paso Datos — monedas (misma UI que `/administracion/monedas`). Opcional: se puede
   continuar sin configurar y volver desde Administración. */

const NEXT = routeAfter("currency");

export function OnboardingCurrencyView() {
  const router = useRouter();
  const onBack = useOnboardingBack("currency");

  return (
    <OnboardingShell
      step="currency"
      description="Define la moneda principal de tu empresa y en qué moneda quieres ver tus reportes."
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <CurrencySettingsView />
        <OnboardingStepActions
          continueType="button"
          continueLabel="Continuar"
          onContinue={() => router.push(NEXT)}
          onSkip={() => router.push(NEXT)}
          skipLabel="Configurar después"
          onBack={onBack}
        />
      </div>
    </OnboardingShell>
  );
}
