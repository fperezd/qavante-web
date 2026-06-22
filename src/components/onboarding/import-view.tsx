"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { useTriggerOnboardingSync, useCompleteOnboarding } from "@/lib/api/onboarding-status";
import { OnboardingShell } from "./onboarding-shell";
import { ONBOARDING_DONE_ROUTE } from "./onboarding-steps";

/* Paso 7 (final) — Traer datos. Dispara la sincronización inicial (SII + banco)
   y, al finalizar, marca el onboarding completado y lleva al dashboard. La sync
   puede ser asíncrona: no bloquea: "lo seguimos trayendo en segundo plano".
   FE-first (endpoints aún no existen). */

export function ImportView() {
  const router = useRouter();
  const sync = useTriggerOnboardingSync();
  const complete = useCompleteOnboarding();
  const triggered = React.useRef(false);

  React.useEffect(() => {
    if (!triggered.current) {
      triggered.current = true;
      sync.mutate();
    }
  }, [sync]);

  function finish() {
    // No atrapar al usuario al final: navegamos al panel pase lo que pase con
    // el complete (el guard/backend reconcilia el estado).
    complete.mutate(undefined, { onSettled: () => router.push(ONBOARDING_DONE_ROUTE) });
  }

  const synced = sync.isSuccess;
  const syncFailed = sync.isError;

  return (
    <OnboardingShell
      step="import"
      description="Estamos trayendo tus datos del SII y tu banco para dejar tu panel listo."
    >
      <div className="flex max-w-md flex-col items-center gap-5 py-6 text-center">
        {!synced && !syncFailed && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-brand-primary" aria-hidden="true" />
            <p className="text-sm text-neutral-mid" role="status">
              Trayendo tus datos… esto puede tardar unos minutos.
            </p>
          </>
        )}

        {synced && (
          <>
            <CheckCircle2 className="h-12 w-12 text-success-600" aria-hidden="true" />
            <p className="text-sm text-neutral-dark">¡Listo! Tu información está cargándose.</p>
          </>
        )}

        {syncFailed && (
          <>
            <Sparkles className="h-12 w-12 text-brand-primary" aria-hidden="true" />
            <p className="text-sm text-neutral-dark">
              Seguimos trayendo tus datos en segundo plano. Puedes entrar a tu panel mientras tanto.
            </p>
          </>
        )}

        <QavanteButton size="lg" loading={complete.isPending} onClick={finish}>
          Ir a mi panel
        </QavanteButton>
      </div>
    </OnboardingShell>
  );
}
