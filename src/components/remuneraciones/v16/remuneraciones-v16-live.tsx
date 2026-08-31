"use client";

import * as React from "react";
import { useBukPayroll, useBukPayrollDetail } from "@/lib/api/buk";
import { useBankMovements } from "@/lib/api/treasury";
import { useOperationalResult } from "@/lib/api/gestion";
import { ApiError } from "@/lib/api/errors";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { normalizePayrollDetalle } from "../payroll-detalle";
import type { BankDebitLike } from "../payroll-conciliacion";
import { periodoDefaultV16 } from "./remuneraciones-v16-model";
import { RemuneracionesV16View } from "./remuneraciones-v16-view";

/* Cableado de V16 · Remuneraciones. La vista es presentacional; acá se resuelven las CUATRO
 * fuentes:
 *
 *   · `GET /api/buk/payroll?period=`        — totales del período (líquido, cotizaciones, dotación).
 *   · `GET /api/buk/payroll/detail?period=` — detalle por persona (líquido + costo empresa,
 *     ADR-0057, owner-only) — de acá sale "Costo empresa" (Ley: nunca líquido + cotizaciones).
 *   · `GET /api/bank-movements?period=`     — para el estado "Pagado ✓" / "Pendiente" por persona.
 *   · `GET /api/management/operational-result?period=` — `revenue` del mismo mes, para el % de
 *     ingresos de "Costo empresa" (Ley 1: reusa el MISMO endpoint que Gestión y V01/V02, no
 *     recalcula ingresos con otra fuente).
 *
 * Período: fijo al último mes CERRADO (`periodoDefaultV16`), sin selector — MVP de una pantalla,
 * una pregunta (Ley 10). Cambiar de período sigue disponible en la Planilla clásica
 * (`/remuneraciones`, tab "Planilla"), a la que el link "liquidación" de cada fila enlaza. */

export function RemuneracionesV16Live() {
  const [periodo] = React.useState(() => periodoDefaultV16(new Date()));

  const payroll = useBukPayroll({ period: periodo });
  const payrollDetail = useBukPayrollDetail(periodo);
  const bankMovements = useBankMovements({ period: periodo });
  const operationalResult = useOperationalResult(periodo);

  const detalle = React.useMemo(
    () => normalizePayrollDetalle(payrollDetail.data),
    [payrollDetail.data],
  );

  const detalleForbidden =
    payrollDetail.error instanceof ApiError && payrollDetail.error.status === 403;

  /* `null` = todavía no se puede afirmar el estado de nadie (cargando o el banco falló); [] es un
   * resultado válido (el mes no tuvo movimientos) y SÍ cuenta como "consultado". */
  const movimientos: BankDebitLike[] | null =
    bankMovements.isLoading || bankMovements.isError
      ? null
      : (bankMovements.data?.items ?? []).map((m) => ({
          id: m.id,
          date: m.date,
          description: m.description,
          amount: m.amount,
          direction: m.direction,
        }));

  const revenue = parseAmountOrNull(operationalResult.data?.revenue);

  if (payroll.isLoading) return <CargandoRemuneraciones />;

  return (
    <RemuneracionesV16View
      periodo={periodo}
      totales={payroll.data?.totales}
      payrollError={payroll.isError ? motivoSinPlanilla(payroll.error) : null}
      onReintentar={() => void payroll.refetch()}
      detalle={detalle}
      detalleForbidden={detalleForbidden}
      movimientos={movimientos}
      revenue={revenue}
    />
  );
}

/** Por qué no llegó la planilla, en lenguaje de dueño. */
export function motivoSinPlanilla(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con Remuneraciones (error de red). Vuelve a intentar en un momento.";
  }
  return "El conector de Remuneraciones no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones.";
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. */
function CargandoRemuneraciones() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Estamos trayendo tu planilla y el detalle por persona (~5 s).
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
