"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { QavanteInlineError } from "@/components/qavante";
import {
  monthValue,
  startDateForMonth,
  useOnboardingImportWindow,
  useSetOnboardingImportWindow,
} from "@/lib/api/onboarding-import-window";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";
import { useOnboardingBack } from "./use-onboarding-back";

/* Primer paso de Conexiones — elige el mes desde el cual importamos SII y banco.
   Debe quedar persistido antes de conectar cualquier fuente. */

const NEXT = routeAfter("import-window");

export function ImportWindowView() {
  const router = useRouter();
  const onBack = useOnboardingBack("import-window");
  const importWindow = useOnboardingImportWindow();
  const setImportWindow = useSetOnboardingImportWindow();
  const [startDate, setStartDate] = React.useState("");

  React.useEffect(() => {
    if (importWindow.data && !startDate) setStartDate(importWindow.data.start_date);
  }, [importWindow.data, startDate]);

  const canContinue = Boolean(startDate) && importWindow.isSuccess && !setImportWindow.isPending;

  async function handleContinue() {
    if (!canContinue) return;
    try {
      await setImportWindow.mutateAsync({ start_date: startDate });
      router.push(NEXT);
    } catch {
      // Error inline bajo el campo.
    }
  }

  return (
    <OnboardingShell
      step="import-window"
      description="Este mes define desde cuándo traemos tus documentos del SII y los movimientos de tu banco."
    >
      <div className="max-w-md space-y-4">
        <p className="text-sm text-neutral-mid">
          Puedes elegir desde el mes en curso hasta tres años atrás. Elegir un mes no cambia nada de
          tu información; solo define desde dónde empezamos a leerla. Siempre usamos el día 1 del
          mes.
        </p>

        {importWindow.isLoading && (
          <p className="flex items-center gap-2 text-sm text-neutral-mid" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Preparando los meses disponibles…
          </p>
        )}

        {importWindow.isError && (
          <QavanteInlineError
            error={importWindow.error}
            what="los meses disponibles"
            onRetry={() => void importWindow.refetch()}
          />
        )}

        {importWindow.data && (
          <div className="space-y-1 rounded-xl border border-border bg-surface-muted p-4">
            <label htmlFor="import-start-month" className="text-sm font-medium text-neutral-dark">
              Mes inicial
            </label>
            <input
              id="import-start-month"
              type="month"
              value={monthValue(startDate)}
              min={monthValue(importWindow.data.earliest_start_date)}
              max={monthValue(importWindow.data.latest_start_date)}
              onChange={(event) => setStartDate(startDateForMonth(event.target.value))}
              className="qv-month-input h-10 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 pr-10 text-sm text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:border-brand-primary"
            />
          </div>
        )}

        {setImportWindow.isError && (
          <p className="text-xs text-danger-500" role="alert">
            No pudimos guardar el mes inicial. Intenta de nuevo.
          </p>
        )}

        <OnboardingStepActions
          continueLabel="Continuar"
          continueLoading={setImportWindow.isPending}
          continueDisabled={!canContinue}
          onContinue={() => void handleContinue()}
          onBack={onBack}
        />
      </div>
    </OnboardingShell>
  );
}
