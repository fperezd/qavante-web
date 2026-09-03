"use client";

import * as React from "react";
import { ApiError } from "@/lib/api/errors";
import { useOnboardingSources } from "@/lib/api/onboarding-sources";
import { useOnboardingSyncRun, useStartOnboardingSyncRun } from "@/lib/api/onboarding-sync-runs";
import { BienvenidaV15View } from "./bienvenida-v15-view";

/* Cableado de V15 · Bienvenida. La vista es presentacional; acá se resuelve la única fuente que
 * necesita — `GET /api/onboarding/status`, vía `useOnboardingSources` (el MISMO adaptador que el
 * hub `/conexiones` y el guard del onboarding, Ley 1: un solo lugar decide "¿está conectada?"). */

export function motivoFuenteBienvenida(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con el estado de tus conexiones (error de red). Vuelve a intentar en un momento.";
  }
  return "El estado de tus conexiones no respondió. Vuelve a intentar en un momento.";
}

/** Reclama el único POST permitido durante una iniciación; protege doble click antes del re-render. */
export function claimSyncRunStart(inFlight: { current: boolean }): boolean {
  if (inFlight.current) return false;
  inFlight.current = true;
  return true;
}

export function BienvenidaV15Live() {
  const [runId, setRunId] = React.useState<string | null>(null);
  const startInFlight = React.useRef(false);
  const { states, isUnknown, isLoading, isError, error, refetch } = useOnboardingSources(true);
  const startRun = useStartOnboardingSyncRun();
  const run = useOnboardingSyncRun(runId);

  const iniciarRun = () => {
    if (!claimSyncRunStart(startInFlight)) return;
    startRun.mutate(undefined, {
      onSuccess: (started) => setRunId(started.run_id),
      onError: () => {
        startInFlight.current = false;
      },
    });
  };

  return (
    <BienvenidaV15View
      states={isUnknown ? null : states}
      cargando={isLoading}
      motivo={isError ? motivoFuenteBienvenida(error) : null}
      onReintentar={() => refetch()}
      run={run.data ?? null}
      cargandoRun={startRun.isPending || (runId !== null && run.isLoading)}
      errorRun={startRun.isError || run.isError}
      onIniciarRun={iniciarRun}
    />
  );
}
