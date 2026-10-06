"use client";

import * as React from "react";
import { QavanteInlineError } from "@/components/qavante";
import { usePayrollWorkerOutstanding } from "@/lib/api/payroll-evidence";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { periodToYyyymm } from "./settlement-board-model";
import { EvidenciaPagosView } from "./evidencia-pagos-view";

/* Contenedor de la evidencia de pagos del período (api#422 / #203). Trae el read model D14 y
   muestra la vista. Owner/admin → degrada honesto si 403.

   Vive DENTRO de la pestaña Conciliación de Remuneraciones, al lado del board accionable, y no
   detrás del flag `remuneracionesV16`: ese flag no está declarado en `wrangler.toml`, así que
   cae al default `false` y la vista quedaría apagada en producción. `remuneraciones` y
   `payrollReconcileBoard` sí están en `"true"`, que es donde esta lectura se puede ver. */

export function EvidenciaPagosLive({ period }: { period: string | null }) {
  const yyyymm = period ? periodToYyyymm(period) : "";
  const query = usePayrollWorkerOutstanding(yyyymm, Boolean(period));

  if (!period) return null;

  if (query.isError) {
    /* El endpoint es owner/admin: un 403 es un rol sin permiso, no una falla. `QavanteInlineError`
       ya traduce cada `ApiError` a su copy, así que no se duplica el mapeo acá. */
    return (
      <QavanteInlineError
        error={query.error}
        what="la evidencia de pagos del período"
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!query.data) {
    return (
      <div
        className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-mid"
        aria-busy="true"
      >
        Leyendo la evidencia de pagos de {formatPeriodLabel(period)}…
      </div>
    );
  }

  return <EvidenciaPagosView periodLabel={formatPeriodLabel(period)} data={query.data} />;
}
