"use client";

import * as React from "react";
import { ApiError } from "@/lib/api/errors";
import { useOnboardingSources } from "@/lib/api/onboarding-sources";
import { BienvenidaV15View } from "./bienvenida-v15-view";

/* Cableado de V15 · Bienvenida. La vista es presentacional; acá se resuelve la única fuente que
 * necesita — `GET /api/onboarding/status`, vía `useOnboardingSources` (el MISMO adaptador que el
 * hub `/conexiones` y el guard del onboarding, Ley 1: un solo lugar decide "¿está conectada?"). */

const ISSUE_SUCESOR = "#100";

export function motivoFuenteBienvenida(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con el estado de tus conexiones (error de red). Vuelve a intentar en un momento.";
  }
  return "El estado de tus conexiones no respondió. Vuelve a intentar en un momento.";
}

export function BienvenidaV15Live({ issueSucesor = ISSUE_SUCESOR }: { issueSucesor?: string }) {
  const [hoy] = React.useState(() => new Date());
  const { states, isUnknown, isLoading, isError, error, refetch } = useOnboardingSources(true);

  return (
    <BienvenidaV15View
      states={isUnknown ? null : states}
      cargando={isLoading}
      motivo={isError ? motivoFuenteBienvenida(error) : null}
      onReintentar={() => refetch()}
      issueSucesor={issueSucesor}
      hoy={hoy}
    />
  );
}
