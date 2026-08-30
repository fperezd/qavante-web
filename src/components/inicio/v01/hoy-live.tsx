"use client";

import * as React from "react";
import { QavanteInlineError } from "@/components/qavante";
import { useDashboardSummary } from "@/lib/api/dashboard";
import { useMe } from "@/lib/api/users";
import { HoyView } from "./hoy-view";

/* Cableado de V01 · Hoy. La vista es presentacional; acá se resuelven las dos fuentes:
 *
 *   · `GET /api/dashboard/summary` — caja, brecha, cobranza, resultado y las acciones
 *     prioritarias (mismo endpoint que el Inicio actual y que el hero de `/caja`, que es lo que
 *     sostiene la Ley 1: un concepto, un número);
 *   · `GET /api/me` — la razón social del tenant activo para el crumb.
 *
 * `/api/me` NO bloquea la pantalla: si falla o tarda, el crumb dice "Tu empresa" y el resto se
 * pinta igual. El nombre de la empresa es contexto, no el dato de la vista. */

export function HoyLive() {
  const summary = useDashboardSummary();
  const me = useMe();

  if (summary.isLoading) return <CargandoHoy />;
  if (summary.isError) {
    return (
      <QavanteInlineError
        error={summary.error}
        what="tu parte del día"
        onRetry={() => summary.refetch()}
      />
    );
  }

  return <HoyView data={summary.data ?? null} empresa={me.data?.user?.tenant_name ?? null} />;
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. "Cargando…" a secas es
   exactamente lo que el lint del rediseño persigue. */
function CargandoHoy() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-mid">
        Estamos armando tu parte del día con tu banco y tus documentos del SII (~5 s).
      </p>
      <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-light/30" />
        ))}
      </div>
    </div>
  );
}
