"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlugZap, X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { useOnboardingSources } from "@/lib/api/onboarding-sources";
import { useSourcesStatus } from "@/lib/api/sources-status";
import { ONBOARDING_CONNECTIONS_ROUTE } from "./onboarding-steps";
import { ONBOARDING_SOURCE_META } from "./onboarding-source-meta";
import { pendingConnectionsBanner } from "./pending-connections-model";

/* ENTRADA VISIBLE para retomar una conexión diferida (patrón "siempre wizard,
   con conexiones diferibles", Fernando 2026-08-12). Sin esto, "lo conectas
   después" no tendría dónde volver: el usuario terminaría el registro con el
   banco o el SII sin conectar y ningún camino de vuelta.

   Alcance real (hallazgo del review del PR #935): esto se monta en el layout de
   (app), o sea en TODAS las pantallas y para TODOS los tenants existentes (el
   backfill los dejó `completed = true`). Por eso:

   - la decisión vive en `pending-connections-model.ts` y exige que el estado
     canónico (`GET /api/sources/status`) diga `missing`: nunca se le dice "te
     falta conectar" a quien tiene la fuente conectada con un sync degradado o
     con error (eso lo reporta el indicador de sincronización del header);
   - es DESCARTABLE por sesión de navegación, no un cartel permanente;
   - tiene su propio flag (`onboardingBanner`), OFF hasta validarlo: el wizard
     puede estar ON sin que este aviso alcance a los clientes vivos. */

export function PendingConnectionsBanner() {
  const router = useRouter();
  const { states, isUnknown, completed } = useOnboardingSources(true);
  const canonical = useSourcesStatus(true);
  const [dismissed, setDismissed] = React.useState(false);

  const decision = pendingConnectionsBanner({
    states,
    isUnknown,
    completed,
    sources: canonical.data?.sources,
    sourcesUnknown: !canonical.data,
    dismissed,
  });

  if (!decision.mostrar) return null;

  const names = decision.sources.map((id) => ONBOARDING_SOURCE_META[id].label).join(" y ");

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
      <div className="flex items-center gap-1">
        <QavanteButton size="sm" onClick={() => router.push(ONBOARDING_CONNECTIONS_ROUTE)}>
          Conectar ahora
        </QavanteButton>
        <QavanteButton
          size="sm"
          variant="ghost"
          aria-label="Cerrar aviso"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </QavanteButton>
      </div>
    </div>
  );
}
