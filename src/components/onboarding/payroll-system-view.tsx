"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { QavanteInlineError } from "@/components/qavante";
import { useDeclarePayrollSystem, usePayrollSystem } from "@/lib/api/payroll-system";
import {
  PAYROLL_SYSTEM_OPTIONS,
  isPayrollSystemId,
  periodOf,
} from "@/components/remuneraciones/payroll-system-form";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";
import { useOnboardingBack } from "./use-onboarding-back";

/* Paso — ¿con qué sistema pagas tus sueldos? (CC-API ADR-0122).

   Declara el sistema de la empresa que se está creando, con vigencia desde el mes en
   curso (en el onboarding no hay historia que respetar; el cambio con fecha vive en
   Configuración). Es un paso de DECISIÓN, no de conexión: no conecta ninguna fuente,
   así que no va al hub de conexiones diferidas.

   Dos decisiones de la pantalla:

   - **Nada preseleccionado.** Preseleccionar BUK es exactamente lo que este trabajo
     vino a cerrar; que la empresa no haya elegido tiene que verse así.
   - **Se puede omitir.** Nada bloquea el registro (patrón del wizard). Omitir deja el
     sistema sin declarar, y Qavante sigue suponiendo BUK hasta que se declare — así
     que el copy lo dice en vez de dejarlo como un detalle silencioso. */

const NEXT = routeAfter("payroll-system");

export function PayrollSystemOnboardingView() {
  const router = useRouter();
  const onBack = useOnboardingBack("payroll-system");
  const current = usePayrollSystem();
  const declare = useDeclarePayrollSystem();
  const declared = isPayrollSystemId(current.data?.payroll_system)
    ? current.data.payroll_system
    : null;
  const [selected, setSelected] = React.useState<string | null>(null);
  const choice = selected ?? declared;

  function handleContinue() {
    if (!choice) {
      router.push(NEXT);
      return;
    }
    declare.mutate(
      { payroll_system: choice, effective_from_period: periodOf(new Date()) },
      { onSuccess: () => router.push(NEXT) },
    );
  }

  return (
    <OnboardingShell
      step="payroll-system"
      description="Dinos con qué sistema pagas los sueldos y Qavante actúa según eso. Puedes cambiarlo después, cuando cambies de sistema."
    >
      <div className="space-y-5">
        <ul className="space-y-2" role="radiogroup" aria-label="Sistema de remuneraciones">
          {PAYROLL_SYSTEM_OPTIONS.map((option) => {
            const active = choice === option.id;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(active ? null : option.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
                    active
                      ? "border-brand-primary bg-brand-primary-50 shadow-sm"
                      : "border-border hover:border-brand-primary/50 hover:bg-surface-muted",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-neutral-dark">{option.label}</span>
                    <span className="mt-0.5 block text-sm text-neutral-mid">
                      {option.description}
                    </span>
                  </span>
                  {active && (
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary text-surface">
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {!choice && (
          <p className="text-sm text-neutral-mid">
            Si lo dejas para después, Qavante va a seguir intentando traer tu planilla desde BUK
            hasta que elijas.
          </p>
        )}

        {declare.isError && (
          <QavanteInlineError error={declare.error} what="tu sistema de remuneraciones" />
        )}

        <OnboardingStepActions
          continueType="button"
          continueLabel={choice ? "Guardar y continuar" : "Continuar"}
          continueLoading={declare.isPending}
          onContinue={handleContinue}
          onSkip={() => router.push(NEXT)}
          onBack={onBack}
        />
      </div>
    </OnboardingShell>
  );
}
