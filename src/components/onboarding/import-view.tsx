"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useTriggerOnboardingSync, useCompleteOnboarding } from "@/lib/api/onboarding-status";
import { ONBOARDING_SOURCE_IDS, useOnboardingSources } from "@/lib/api/onboarding-sources";
import { OnboardingShell } from "./onboarding-shell";
import { ONBOARDING_CONNECTIONS_ROUTE, ONBOARDING_DONE_ROUTE } from "./onboarding-steps";
import { ONBOARDING_SOURCE_META } from "./onboarding-source-meta";
import { syncStatusText } from "./sync-status-text";

/* Paso 7 (final) — Traer datos. Dispara la sincronización inicial (SII + banco)
   y, al finalizar, marca el onboarding completado y lleva al dashboard. La sync
   puede ser asíncrona: no bloquea: "lo seguimos trayendo en segundo plano".
   Respuesta per-source partial-success (`sources.{sii,bank}.status`).

   "Siempre wizard, con conexiones diferibles": el onboarding se completa aunque
   queden fuentes sin conectar. Lo que NO se hace es esconderlo — se listan las
   pendientes con su acceso directo al hub de conexiones. */

const SOURCE_LABEL = { sii: "SII", bank: "Banco" } as const;

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
    /* Navegamos SOLO si el backend confirmó el cierre. Antes se navegaba en
       `onSettled` (pasara lo que pasara) "para no atrapar al usuario", pero el
       efecto era el contrario: si el complete falla, el onboarding sigue
       incompleto y el guard lo rebota de vuelta al wizard, sin decirle nada.
       Con el complete OK, `useCompleteOnboarding` deja el status nuevo en la
       cache compartida → el guard ya lo lee completado y no redirige. */
    complete.mutate(undefined, { onSuccess: () => router.push(ONBOARDING_DONE_ROUTE) });
  }

  const synced = sync.isSuccess;
  const syncFailed = sync.isError;

  /* Fuentes que quedan sin conectar al cerrar el wizard. Se listan explícitamente
     con su acceso al hub: completar el onboarding no significa "todo listo". */
  const { states, isUnknown } = useOnboardingSources(true);
  const unconnected = isUnknown
    ? []
    : ONBOARDING_SOURCE_IDS.filter((id) => states[id] !== "connected");

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
            {sync.data?.sources && (
              <ul className="space-y-1 text-xs text-neutral-mid">
                {(["sii", "bank"] as const).map((src) => {
                  // Guard: el sync puede volver con solo una fuente (ej. banco no conectado) →
                  // no derefear un `sources[src]` ausente (crashearía la última pantalla).
                  const s = sync.data!.sources[src];
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
              Seguimos trayendo tus datos en segundo plano. Puedes entrar a tu panel mientras tanto.
            </p>
          </>
        )}

        {/* Conexiones que quedaron para después: se dicen, no se esconden. */}
        {unconnected.length > 0 && (
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

        <QavanteButton size="lg" loading={complete.isPending} onClick={finish}>
          {complete.isError ? "Reintentar" : "Ir a mi panel"}
        </QavanteButton>
      </div>
    </OnboardingShell>
  );
}
