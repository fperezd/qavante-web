"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Info, Loader2, Sparkles } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useTriggerOnboardingSync, useCompleteOnboarding } from "@/lib/api/onboarding-status";
import { ONBOARDING_SOURCE_IDS, useOnboardingSources } from "@/lib/api/onboarding-sources";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { ONBOARDING_CONNECTIONS_ROUTE, routeAfter } from "./onboarding-steps";
import { ONBOARDING_SOURCE_META } from "./onboarding-source-meta";
import { syncStatusText } from "./sync-status-text";
import { useOnboardingBack } from "./use-onboarding-back";

/* Paso 8 — Traer datos. Dispara la sincronización inicial (SII + banco) y, al
   finalizar, marca el onboarding completado y pasa al paso que SÍ cierra el wizard:
   la primera decisión (`/onboarding/listo`). Completar acá y mostrar la cifra después
   es deliberado — la última pantalla es el premio, no una compuerta más. La sync
   puede ser asíncrona: no bloquea: "lo seguimos trayendo en segundo plano".
   Respuesta per-source partial-success (`sources.{sii,bank}.status`).

   "Siempre wizard, con conexiones diferibles": el onboarding se completa aunque
   queden fuentes sin conectar. Lo que NO se hace es esconderlo — se listan las
   pendientes con su acceso directo al hub de conexiones. */

const SOURCE_LABEL = { sii: "SII", bank: "Banco" } as const;

const NEXT = routeAfter("import");

export function ImportView() {
  const router = useRouter();
  const onBack = useOnboardingBack("import");
  const { mutate: triggerSync, isPending, isSuccess, isError, data } = useTriggerOnboardingSync();
  const complete = useCompleteOnboarding();
  const triggered = React.useRef(false);

  const { states, isLoading: sourcesLoading, isUnknown } = useOnboardingSources(true);
  const connectedIds = isUnknown
    ? []
    : ONBOARDING_SOURCE_IDS.filter((id) => states[id] === "connected");
  const unconnected = isUnknown
    ? []
    : ONBOARDING_SOURCE_IDS.filter((id) => states[id] !== "connected");
  const sourcesReady = !sourcesLoading && !isUnknown;
  const skipSync = sourcesReady && connectedIds.length === 0;

  React.useEffect(() => {
    if (!sourcesReady || skipSync) return;
    if (triggered.current) return;
    triggered.current = true;
    triggerSync();
  }, [sourcesReady, skipSync, triggerSync]);

  function finish() {
    complete.mutate(undefined, { onSuccess: () => router.push(NEXT) });
  }

  const synced = skipSync || isSuccess;
  const syncFailed = !skipSync && isError;
  const waitingOnSync = sourcesReady && !skipSync && isPending;

  const description = skipSync
    ? "No hay SII ni banco conectados todavía. Cuando los conectes, traeremos tus datos automáticamente."
    : connectedIds.length === 1
      ? `Iniciamos la importación desde tu ${SOURCE_LABEL[connectedIds[0]!]}.`
      : "Estamos trayendo tus datos del SII y tu banco para dejar tu panel listo.";

  return (
    <OnboardingShell step="import" description={description}>
      <div className="flex max-w-md flex-col items-center gap-5 py-6 text-center">
        {sourcesLoading && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-brand-primary" aria-hidden="true" />
            <p className="text-sm text-neutral-mid" role="status">
              Revisando tus conexiones…
            </p>
          </>
        )}

        {sourcesReady && skipSync && (
          <>
            <Info className="h-12 w-12 text-brand-primary" aria-hidden="true" />
            <p className="text-sm text-neutral-dark">
              No hay nada que importar ahora. Conecta el SII o tu banco cuando quieras; la primera
              conexión dispara la traída de datos.
            </p>
          </>
        )}

        {waitingOnSync && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-brand-primary" aria-hidden="true" />
            <p className="text-sm text-neutral-mid" role="status">
              Trayendo tus datos… esto puede tardar unos minutos.
            </p>
          </>
        )}

        {sourcesReady && synced && !skipSync && (
          <>
            <CheckCircle2 className="h-12 w-12 text-success-600" aria-hidden="true" />
            <p className="text-sm text-neutral-dark">La importación fue iniciada.</p>
            <p className="text-xs text-neutral-mid">
              Al entrar a tu panel, Qavante actualizará las cifras con la información que termine de
              procesar. No mostraremos una evaluación anterior como si estuviera al día.
            </p>
            {data?.sources && (
              <ul className="space-y-1 text-xs text-neutral-mid">
                {(["sii", "bank"] as const).map((src) => {
                  const s = data.sources[src];
                  if (!s) return null;
                  return (
                    <li key={src}>
                      {SOURCE_LABEL[src]}: {syncStatusText(s.status)}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {syncFailed && (
          <>
            <Sparkles className="h-12 w-12 text-brand-primary" aria-hidden="true" />
            <p className="text-sm text-neutral-dark">
              No pudimos iniciar la importación ahora. Puedes entrar a tu panel; algunas cifras no
              estarán disponibles hasta que vuelvas a sincronizar.
            </p>
          </>
        )}

        {sourcesReady && unconnected.length > 0 && (
          <div className="w-full rounded-xl border border-border bg-surface-muted p-4 text-left">
            <p className="text-sm font-medium text-neutral-dark">
              Te queda{" "}
              {unconnected.length === 1 ? "una conexión" : `${unconnected.length} conexiones`} por
              hacer
            </p>
            <ul className="mt-1 space-y-1 text-xs text-neutral-mid">
              {unconnected.map((id) => (
                <li key={id}>
                  <strong>{ONBOARDING_SOURCE_META[id].label}</strong>:{" "}
                  {ONBOARDING_SOURCE_META[id].missingConsequence}
                </li>
              ))}
            </ul>
            <QavanteButton
              variant="ghost"
              size="sm"
              className="mt-2 px-0"
              onClick={() => router.push(ONBOARDING_CONNECTIONS_ROUTE)}
            >
              Conectarlas ahora
            </QavanteButton>
          </div>
        )}

        {complete.isError && (
          <div
            role="alert"
            className="flex w-full items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-left text-sm text-danger-500"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>
              {complete.error instanceof ApiError
                ? apiErrorToUserMessage(complete.error)
                : "No pudimos cerrar tu registro."}{" "}
              Tus datos están guardados. Intenta de nuevo.
            </p>
          </div>
        )}

        {sourcesReady && (
          <OnboardingStepActions
            continueType="button"
            continueLabel={complete.isError ? "Reintentar" : "Ver mi primera decisión"}
            continueLoading={complete.isPending}
            onContinue={finish}
            onBack={onBack}
          />
        )}
      </div>
    </OnboardingShell>
  );
}
