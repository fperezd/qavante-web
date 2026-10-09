"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Wallet } from "lucide-react";
import { QavanteButton, QavanteCard } from "@/components/qavante";
import { useOnboardingReadiness } from "@/lib/api/onboarding-readiness";
import { OnboardingShell } from "./onboarding-shell";
import { ONBOARDING_DONE_ROUTE } from "./onboarding-steps";
import { useOnboardingBack } from "./use-onboarding-back";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { readinessHeadline, readinessStep } from "./readiness-copy";

/* Paso 9 (final) — Tu primera decisión.

   ## El hueco que cierra

   Hasta acá el wizard conectaba fuentes y mandaba al panel. Conectar fuentes no es
   una decisión: nadie mueve una línea porque un banco quedó vinculado. Esta pantalla
   es el puente que faltaba — el usuario sale del registro con **una cifra que puede
   usar mañana** y con la única acción que la mejora.

   ## Las reglas de esta pantalla

   - **Siempre un número.** La API garantiza `minimum_cash` y `essential_outflow_days_covered` con
     valor en cualquier estado del tenant; acá nunca hay una rama sin cifra. Mientras
     la lectura viaja se muestra el esqueleto de la cifra, no un texto de espera que
     reemplace al número.
   - **Siempre qué cubre el número.** Un monto solo no se puede usar: «cubre 30 días
     de tus gastos esenciales» es lo que lo vuelve accionable.
   - **UNA acción.** No un checklist de pendientes: eso es un porcentaje disfrazado.
   - **Nada de etiquetas de confianza.** El peldaño de cálculo (`basis`) viaja en el
     contrato para la auditoría y NO se imprime. Si hay menos datos, la API ya
     devolvió un piso más conservador — el ajuste pasa en el cálculo, no en una
     advertencia que le traslade la duda al dueño.

   El onboarding ya quedó cerrado en el paso anterior, así que el guard no interviene
   y esta pantalla es el premio, no una compuerta. */

export function ReadyView() {
  const router = useRouter();
  const onBack = useOnboardingBack("ready");
  const { data, isError } = useOnboardingReadiness(true);
  const fin = data?.financial;

  /* Un deploy del front adelantado al de la API deja `financial` ausente. En ese caso
     la pantalla no inventa una cifra NI se queda en blanco: pasa derecho al panel,
     que es el comportamiento que el wizard tenía antes de este paso. */
  const unavailable = isError || (data !== undefined && fin === undefined);
  React.useEffect(() => {
    if (unavailable) router.replace(ONBOARDING_DONE_ROUTE);
  }, [unavailable, router]);

  const headline = fin ? readinessHeadline(fin) : null;
  const step = fin ? readinessStep(fin) : null;

  return (
    <OnboardingShell
      step="ready"
      description="Con lo que ya conectaste, esto es lo que Qavante puede decidir contigo."
    >
      <div className="flex w-full max-w-md flex-col gap-5">
        <QavanteCard className="flex flex-col gap-2 p-6 text-center">
          <Wallet className="mx-auto h-7 w-7 text-brand-primary" aria-hidden="true" />
          {headline ? (
            <>
              <p className="text-2xl font-semibold text-neutral-dark">{headline.title}</p>
              <p className="text-sm text-neutral-mid">{headline.covers}</p>
              <p className="mt-2 border-t border-border/60 pt-3 text-sm text-neutral-dark">
                {headline.coverage}
              </p>
            </>
          ) : (
            /* Esqueleto de la CIFRA, no un mensaje en su lugar: el usuario espera un
               número y lo que aparece tiene la forma de un número. */
            <>
              <div
                className="mx-auto h-8 w-48 animate-pulse rounded-md bg-surface-muted"
                role="status"
                aria-label="Calculando tu piso de caja"
              />
              <div className="mx-auto h-4 w-56 animate-pulse rounded-md bg-surface-muted" />
            </>
          )}
        </QavanteCard>

        {fin && (
          <QavanteCard className="flex flex-col gap-3 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-success-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-neutral-dark">Qavante ya decide contigo</p>
                <p className="mt-1 text-sm text-neutral-mid">{fin.unlocked_decision}</p>
              </div>
            </div>
            {step && (
              <div className="border-t border-border/60 pt-3">
                <p className="text-sm font-medium text-neutral-dark">{step.label}</p>
                <p className="mt-1 text-sm text-neutral-mid">{step.reason}</p>
                <QavanteButton
                  variant="ghost"
                  size="sm"
                  className="mt-2 px-0"
                  onClick={() => router.push(step.route)}
                >
                  {step.label}
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </QavanteButton>
              </div>
            )}
          </QavanteCard>
        )}

        <OnboardingStepActions
          continueType="button"
          continueLabel="Ir a mi panel"
          onContinue={() => router.push(ONBOARDING_DONE_ROUTE)}
          onBack={onBack}
        />
      </div>
    </OnboardingShell>
  );
}
