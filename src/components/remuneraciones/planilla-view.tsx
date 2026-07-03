"use client";

import * as React from "react";
import { Wallet, Inbox, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { QavanteBadge, QavanteCard, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import type { PayrollResponse, PayrollTotales } from "@/lib/api/buk";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { SiiPeriodForm } from "@/components/sii/sii-period-form";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import {
  detalleCuadra,
  normalizePayrollDetalle,
  sumLiquido,
  type EmployeePayroll,
} from "./payroll-detalle";

/* Planilla — totales del período (BUK) + detalle por empleado (líquido) para
   conciliación bancaria. El detalle por empleado (`payroll.detalle`) es contrato
   FE-first: si el backend todavía no lo expone, se muestra solo el agregado con
   un aviso. Presentacional: recibe la query por prop (el page invoca useBukPayroll). */

export interface PlanillaViewProps {
  /** Período consultado (null = todavía no se consultó). */
  period: string | null;
  onPeriodChange: (period: string) => void;
  query: UseQueryResult<PayrollResponse, unknown>;
  /** Selector de período custom (filtro de rango, idéntico al Libro). Reemplaza
   *  al SiiPeriodForm interno. Aditivo. */
  periodForm?: React.ReactNode;
}

export function PlanillaView({ period, onPeriodChange, query, periodForm }: PlanillaViewProps) {
  const totales = query.data?.totales;
  const detalle = React.useMemo(() => normalizePayrollDetalle(query.data), [query.data]);

  return (
    <div className="space-y-4">
      {periodForm ?? (
        <SiiPeriodForm
          onSubmit={onPeriodChange}
          loading={query.isFetching}
          hint="Totales de la planilla de remuneraciones del mes (haberes, descuentos y líquido)."
        />
      )}

      {!period && (
        <QavanteEmpty
          icon={Wallet}
          title="Consulta la planilla del período"
          description="Elige un mes y vas a ver los totales de remuneraciones: haberes, descuentos, líquido a pagar e imponible, más la cantidad de empleados considerados."
        />
      )}

      {period && query.isLoading && (
        <div
          className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label="Consultando la planilla"
        />
      )}

      {period && query.isError && (
        <QavanteInlineError error={query.error} what="la planilla de remuneraciones" />
      )}

      {period && query.data && !totales && (
        <QavanteEmpty
          icon={Inbox}
          title="Sin planilla en el período"
          description="No hay totales de remuneraciones para este mes. Prueba con otro período."
        />
      )}

      {period && totales && (
        <PlanillaTotales period={period} totales={totales} detalle={detalle} />
      )}
    </div>
  );
}

function PlanillaTotales({
  period,
  totales,
  detalle,
}: {
  period: string;
  totales: PayrollTotales;
  detalle: EmployeePayroll[];
}) {
  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{formatPeriodLabel(period)}</span>
          <QavanteBadge variant="info">
            {totales.empleados_contados}{" "}
            {totales.empleados_contados === 1 ? "empleado" : "empleados"}
          </QavanteBadge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Líquido = figura principal */}
        <div className="rounded-xl bg-brand-primary-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary-700">
            Líquido a pagar
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand-deep">
            {formatClp(totales.total_liquido)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Total haberes" value={totales.total_haberes} />
          <Metric label="Total descuentos" value={totales.total_descuentos} tone="muted" />
          <Metric label="Total imponible" value={totales.total_imponible} tone="muted" />
        </div>

        {detalle.length > 0 ? (
          <DetalleEmpleados detalle={detalle} totalLiquido={totales.total_liquido} />
        ) : (
          <p className="flex items-start gap-1.5 text-xs text-neutral-mid">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              El <strong>detalle por empleado</strong> (líquido de cada trabajador, para conciliar
              contra el banco) se está habilitando en el conector. Por ahora se muestran los totales
              del período.
            </span>
          </p>
        )}
      </div>
    </QavanteCard>
  );
}

/* Detalle por empleado — líquido de cada trabajador para conciliación bancaria.
   Incluye un indicador de cuadratura (suma del detalle vs total agregado): si
   cuadra, el detalle está completo y es confiable para conciliar. */
function DetalleEmpleados({
  detalle,
  totalLiquido,
}: {
  detalle: EmployeePayroll[];
  totalLiquido: number;
}) {
  const cuadra = detalleCuadra(detalle, totalLiquido);
  const suma = sumLiquido(detalle);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-dark">Detalle por empleado</h3>
        <span
          className={
            "inline-flex items-center gap-1 text-xs " +
            (cuadra ? "text-success-600" : "text-warning-700")
          }
          title={
            cuadra
              ? "La suma del detalle coincide con el total del período"
              : "La suma del detalle no coincide con el total del período — revisar antes de conciliar"
          }
        >
          {cuadra ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {cuadra ? "Cuadra con el total" : `Descuadre: detalle ${formatClp(suma)}`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Empleado
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                RUT
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Líquido
              </th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((e, i) => (
              <tr
                key={e.id || `${e.nombre}-${i}`}
                className="border-b border-border/60 last:border-b-0 hover:bg-surface-muted"
              >
                <td className="py-2 pr-3 text-neutral-dark">{e.nombre}</td>
                <td className="py-2 pr-3 font-mono text-xs text-neutral-mid">
                  {e.rut ? formatRut(e.rut) : "—"}
                </td>
                <td className="py-2 text-right tabular-nums font-medium text-neutral-dark">
                  {e.liquido !== null ? formatClp(e.liquido) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong font-semibold">
              <td colSpan={2} className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-mid">
                Suma del detalle
              </td>
              <td className="py-2 text-right tabular-nums text-neutral-dark">{formatClp(suma)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-neutral-mid">
        El líquido de cada trabajador se cruza contra los débitos de sueldos del banco para la
        conciliación. Fuente: conector de Remuneraciones (BUK).
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "muted";
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">{label}</p>
      <p
        className={
          "mt-1 text-lg font-semibold tabular-nums " +
          (tone === "muted" ? "text-neutral-mid" : "text-neutral-dark")
        }
      >
        {formatClp(value)}
      </p>
    </div>
  );
}
