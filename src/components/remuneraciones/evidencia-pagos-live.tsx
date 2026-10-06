"use client";

import * as React from "react";
import { QavanteInlineError } from "@/components/qavante";
import {
  usePayrollPeriodEvidence,
  usePayrollWorkerOutstanding,
  yyyymmToDashedPeriod,
} from "@/lib/api/payroll-evidence";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { periodToYyyymm } from "./settlement-board-model";
import { EvidenciaPagosView } from "./evidencia-pagos-view";
import { EvidenciaPeriodoView } from "./evidencia-periodo-view";

/* Contenedor de la evidencia de nómina del período (api#422 / #203). Trae las DOS lecturas del
   mismo ledger D14 y las muestra una sobre otra.

   Por qué dos y no una, que es lo que #203 pedía y faltaba:

   - `GET /api/treasury/payroll-evidence/{YYYY-MM}` cuenta el período entero e incluye la
     categoría **pago observado por verificar**, que la otra lectura no tiene en ninguna cifra.
     Sin ella, un período con un pago observado y sin confirmar se veía en pantalla igual que
     uno donde nadie pagó.
   - `GET /api/admin/treasury/payroll-worker-outstanding/{YYYYMM}` reparte por persona.

   Dos diferencias que no se pueden perder: el período va en `YYYY-MM` en la primera y en
   `YYYYMM` en la segunda, y sólo la segunda es admin. Por eso la evidencia del período se
   renderiza aunque la lectura por trabajador devuelva 403: un CFO sin rol admin veía hasta hoy
   nada más que el board legado, que es justo el que puede rotular un pago asumido.

   Vive DENTRO de la pestaña Conciliación de Remuneraciones, y no detrás del flag
   `remuneracionesV16`: ese flag no está declarado en `wrangler.toml`, así que cae al default
   `false` y la vista quedaría apagada en producción. */

export function EvidenciaPagosLive({ period }: { period: string | null }) {
  const yyyymm = period ? periodToYyyymm(period) : "";
  const dashed = yyyymmToDashedPeriod(yyyymm);
  const periodo = usePayrollPeriodEvidence(dashed, Boolean(period));
  const query = usePayrollWorkerOutstanding(yyyymm, Boolean(period));

  if (!period) return null;

  const label = formatPeriodLabel(period);

  return (
    <div className="space-y-4">
      {periodo.isError ? (
        <QavanteInlineError
          error={periodo.error}
          what="la evidencia del período"
          onRetry={() => void periodo.refetch()}
        />
      ) : periodo.data ? (
        <EvidenciaPeriodoView periodLabel={label} data={periodo.data} />
      ) : (
        <div
          className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-mid"
          aria-busy="true"
        >
          Leyendo la evidencia de {label}…
        </div>
      )}

      {query.isError ? (
        /* El endpoint por trabajador es owner/admin: un 403 es un rol sin permiso, no una falla.
           `QavanteInlineError` ya traduce cada `ApiError` a su copy, así que no se duplica el
           mapeo acá. La evidencia del período de arriba sigue en pantalla. */
        <QavanteInlineError
          error={query.error}
          what="el reparto por persona del período"
          onRetry={() => void query.refetch()}
        />
      ) : query.data ? (
        <EvidenciaPagosView periodLabel={label} data={query.data} />
      ) : (
        <div
          className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-mid"
          aria-busy="true"
        >
          Leyendo el reparto por persona de {label}…
        </div>
      )}
    </div>
  );
}
