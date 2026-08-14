"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlugZap } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { ONBOARDING_SOURCE_IDS, useOnboardingSources } from "@/lib/api/onboarding-sources";
import { ONBOARDING_CONNECTIONS_ROUTE } from "./onboarding-steps";
import { ONBOARDING_SOURCE_META } from "./onboarding-source-meta";

/* ENTRADA VISIBLE para retomar una conexión diferida (patrón "siempre wizard,
   con conexiones diferibles", Fernando 2026-08-12). Sin esto, "lo conectas
   después" no tendría dónde volver: el usuario terminaría el registro con el
   banco o el SII sin conectar y ningún camino de vuelta.

   Solo aparece cuando: el onboarding está COMPLETADO (si no, el guard ya lleva
   al wizard) y hay al menos una fuente sin conectar. Sin dato del backend
   (cargando o error) NO se muestra: nunca afirmamos un estado que no leímos. */

export function PendingConnectionsBanner() {
  const router = useRouter();
  const { states, isUnknown, completed } = useOnboardingSources(true);

  if (isUnknown || !completed) return null;

  const pending = ONBOARDING_SOURCE_IDS.filter((id) => states[id] !== "connected");
  if (pending.length === 0) return null;

  const names = pending.map((id) => ONBOARDING_SOURCE_META[id].label).join(" y ");

  return (
    /* Sin margen propio: el contenedor de (app) ya espacia con `space-y-6`. */
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-500/30 bg-warning-50/60 px-4 py-3"
    >
      <div className="flex min-w-0 items-start gap-3">
        <PlugZap className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-700" aria-hidden="true" />
        <p className="text-sm text-neutral-dark">
          Te falta conectar <strong>{names}</strong>. Mientras tanto, Qavante no muestra esos datos
          (no los inventamos ni los damos por cero).
        </p>
      </div>
      <QavanteButton size="sm" onClick={() => router.push(ONBOARDING_CONNECTIONS_ROUTE)}>
        Conectar ahora
      </QavanteButton>
    </div>
  );
}
