"use client";

import * as React from "react";
import { useAccountsPayable, usePayableDuplicateAnomalies } from "@/lib/api/pagos";
import { ApiError } from "@/lib/api/errors";
import { PagarV05View } from "./pagar-v05-view";

/* Cableado de V05 · Pagar. La vista es presentacional; acá se resuelve la ÚNICA fuente:
 *
 *   · `GET /api/treasury/accounts-payable` — total, tramos `due_*`, ítems con fecha (tope 100),
 *     lo sin fecha (`undated_*`), caja proyectada a 14 días con su moneda, y `missing_sources`.
 *     Es la MISMA fuente que "Sale · 14 días" en V02 · Caja (Ley 1).
 *
 * A propósito NO se mezclan acá los maestros RCV de compras/honorarios que usa Pagar v2 (flag
 * `pagarV2`, OFF): combinar dos fuentes daría un "Vencido" distinto del que se puede derivar del
 * endpoint canónico, y la Ley 1 pide un concepto = un número = una fuente. Lo que el endpoint no
 * lista, la vista lo DECLARA (sin fecha, tope, monedas sin TC) en vez de completarlo por otro
 * camino. */

const ISSUE_SUCESOR = "#88";

/** Por qué no llegó el registro, en lenguaje de dueño. */
export function motivoSinPagos(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con el registro de pagos (error de red). Vuelve a intentar en un momento.";
  }
  return "El registro de pagos no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones.";
}

export function PagarV05Live({ issueSucesor = ISSUE_SUCESOR }: { issueSucesor?: string }) {
  const [hoy] = React.useState(() => new Date());
  const ap = useAccountsPayable();
  const anomalias = usePayableDuplicateAnomalies();

  if (ap.isLoading) return <CargandoPagar />;

  return (
    <PagarV05View
      pagos={ap.data ?? null}
      pagosMotivo={ap.isError ? motivoSinPagos(ap.error) : null}
      anomalias={anomalias.isSuccess ? anomalias.data.items : null}
      anomaliasMotivo={
        anomalias.isError
          ? "No pudimos revisar posibles duplicados; no los estamos descartando."
          : anomalias.isLoading
            ? "Estamos revisando posibles duplicados (~5 s)."
            : null
      }
      onReintentar={() => {
        void ap.refetch();
        void anomalias.refetch();
      }}
      issueSucesor={issueSucesor}
      hoy={hoy}
    />
  );
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. */
function CargandoPagar() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Estamos trayendo tus cuentas por pagar y sus vencimientos (~5 s).
      </p>
      <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden="true" />
    </div>
  );
}
