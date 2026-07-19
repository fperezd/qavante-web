"use client";

import * as React from "react";
import { Wallet, Inbox, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { QavanteBadge, QavanteCard, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { stickyScroll, stickyHead, stickyFoot } from "@/components/table/sticky-table";
import type { PayrollResponse, PayrollTotales } from "@/lib/api/buk";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { SiiPeriodForm } from "@/components/sii/sii-period-form";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import {
  detalleCuadra,
  readPayrollObligaciones,
  sumCostoEmpresa,
  sumHaberes,
  sumLiquido,
  tieneCostoEmpresa,
  tieneHaberesPorEmpleado,
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
  /** Detalle por empleado (líquido individual, ADR-0057). [] si no hay/no-owner.
   *  Lo resuelve el page desde /api/buk/payroll/detail. */
  detalle?: EmployeePayroll[];
  /** El detalle vino 403 (owner-only): distingue "solo para el dueño" de "sin
   *  dato del período". Desde CC-API #542 el owner ya no recibe 403. */
  detalleForbidden?: boolean;
  /** Impuesto de remuneraciones (IUSC, código 48 del F29) del período. NO viene en
   *  el payroll de BUK — el page lo resuelve desde `/api/sii/f29/impuesto`
   *  (`impuesto_trabajadores`, fuente BUK). `undefined` = el page no lo pasó (se cae
   *  al viejo total del payroll); `null` = consultado pero sin dato → "En preparación". */
  impuestoF29?: number | null;
  /** Selector de período custom (filtro de rango, idéntico al Libro). Reemplaza
   *  al SiiPeriodForm interno. Aditivo. */
  periodForm?: React.ReactNode;
}

export function PlanillaView({
  period,
  onPeriodChange,
  query,
  detalle = [],
  detalleForbidden = false,
  impuestoF29,
  periodForm,
}: PlanillaViewProps) {
  const totales = query.data?.totales;

  return (
    <div className="space-y-4">
      {periodForm ?? (
        <SiiPeriodForm
          onSubmit={onPeriodChange}
          loading={query.isFetching}
          hint="Planilla del mes: líquido a pagar, impuesto del F29 e imposiciones de Previred."
        />
      )}

      {!period && (
        <QavanteEmpty
          icon={Wallet}
          title="Consulta la planilla del período"
          description="Elige un mes y vas a ver la planilla del período: el líquido a pagar a los trabajadores, el impuesto que se entera en el F29 y las imposiciones de Previred, más la cantidad de empleados considerados."
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
        <PlanillaTotales
          period={period}
          totales={totales}
          detalle={detalle}
          detalleForbidden={detalleForbidden}
          impuestoF29={impuestoF29}
        />
      )}
    </div>
  );
}

function PlanillaTotales({
  period,
  totales,
  detalle,
  detalleForbidden,
  impuestoF29,
}: {
  period: string;
  totales: PayrollTotales;
  detalle: EmployeePayroll[];
  detalleForbidden: boolean;
  impuestoF29?: number | null;
}) {
  const obligaciones = readPayrollObligaciones(totales as Record<string, unknown>);
  // El impuesto de remuneraciones (IUSC) NO viene en el payroll de BUK; llega del F29
  // (código 48, `/api/sii/f29/impuesto`). Si el page lo pasó, gana sobre el payroll.
  const impuesto = impuestoF29 !== undefined ? impuestoF29 : obligaciones.impuestoF29;
  // Haberes agregados (bruto del período). El campo existe en PayrollTotales; si viniera
  // 0/ausente (conector sin poblarlo) no mostramos el bloque, para no leerse como "$0 de sueldos".
  const totalHaberes =
    typeof totales.total_haberes === "number" && totales.total_haberes > 0
      ? totales.total_haberes
      : null;
  // Costo empresa del período: el payroll no trae un agregado, pero el detalle sí lo trae
  // por empleado (costo_empresa) → lo sumamos. null si el detalle no está (no-owner/sin dato).
  const costoEmpresaTotal = tieneCostoEmpresa(detalle) ? sumCostoEmpresa(detalle) : null;
  // Tarjetas grandes visibles: Líquido siempre; Haberes y Costo empresa si hay dato.
  const bigCards = 1 + (totalHaberes !== null ? 1 : 0) + (costoEmpresaTotal !== null ? 1 : 0);
  const bigGrid =
    bigCards >= 3
      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      : bigCards === 2
        ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
        : "";
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
        {/* Lo que gana el equipo (haberes → líquido) y lo que le cuesta a la empresa (costo
            empresa = líquido + leyes sociales). Se muestran las tarjetas que tienen dato. */}
        <div className={bigGrid}>
          {totalHaberes !== null && (
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
                Total haberes
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-dark">
                {formatClp(totalHaberes)}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-neutral-mid">
                Lo que gana el equipo antes de descuentos (imponibles + no imponibles).
              </p>
            </div>
          )}
          <div className="rounded-xl bg-brand-primary-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary-700">
              Líquido a pagar
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-brand-deep">
              {formatClp(totales.total_liquido)}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-neutral-mid">
              Lo que se deposita, después de descuentos.
            </p>
          </div>
          {costoEmpresaTotal !== null && (
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
                Costo empresa
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-dark">
                {formatClp(costoEmpresaTotal)}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-neutral-mid">
                Lo que le cuesta el equipo a la empresa: líquido + leyes sociales.
              </p>
            </div>
          )}
        </div>

        {/* Además del líquido, la planilla genera dos desembolsos: el impuesto de
            remuneraciones que se entera en el F29 y las cotizaciones a Previred. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Metric
            label="Impuestos (F29)"
            value={impuesto}
            help="Impuesto de remuneraciones (Impuesto Único de 2ª Categoría, código 48) a enterar en el F29."
          />
          <Metric
            label="Imposiciones (Previred)"
            value={obligaciones.previred}
            help="Cotizaciones previsionales del período (AFP, salud y seguro de cesantía) a pagar en Previred."
          />
        </div>
        {(impuesto === null || obligaciones.previred === null) && (
          <p className="text-xs text-neutral-mid">
            Los montos de <strong>impuestos</strong> e <strong>imposiciones</strong> se están
            habilitando (el impuesto viene del F29; las imposiciones, de BUK). En cuanto haya dato
            del período, se muestran acá.
          </p>
        )}

        {detalle.length > 0 ? (
          <DetalleEmpleados detalle={detalle} totalLiquido={totales.total_liquido} />
        ) : (
          <p className="flex items-start gap-1.5 text-xs text-neutral-mid">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {detalleForbidden ? (
                <>
                  El <strong>detalle por empleado</strong> (líquido individual) es visible solo para
                  el <strong>dueño</strong> de la cuenta. Se muestran los totales del período.
                </>
              ) : (
                <>
                  No hay <strong>detalle por empleado</strong> para este período. Se muestran los
                  totales del período.
                </>
              )}
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
  const conHaberes = tieneHaberesPorEmpleado(detalle);
  const sumaHaberes = sumHaberes(detalle);
  const conCosto = tieneCostoEmpresa(detalle);
  const sumaCosto = sumCostoEmpresa(detalle);
  const anchas = (conHaberes ? 1 : 0) + (conCosto ? 1 : 0); // columnas $ extra sobre Líquido

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

      <div className={stickyScroll}>
        <table className={"w-full text-sm " + (anchas >= 2 ? "min-w-[720px]" : anchas === 1 ? "min-w-[640px]" : "min-w-[520px]")}>
          <thead className={stickyHead}>
            <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Empleado
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                RUT
              </th>
              {conHaberes && (
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Haberes
                </th>
              )}
              {conCosto && (
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Costo empresa
                </th>
              )}
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
                {conHaberes && (
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                    {e.haberes !== null ? formatClp(e.haberes) : "—"}
                  </td>
                )}
                {conCosto && (
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                    {e.costoEmpresa !== null ? formatClp(e.costoEmpresa) : "—"}
                  </td>
                )}
                <td className="py-2 text-right tabular-nums font-medium text-neutral-dark">
                  {e.liquido !== null ? formatClp(e.liquido) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className={stickyFoot}>
            <tr className="border-t-2 border-border-strong font-semibold">
              <td
                colSpan={2}
                className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-mid"
              >
                Suma del detalle
              </td>
              {conHaberes && (
                <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                  {formatClp(sumaHaberes)}
                </td>
              )}
              {conCosto && (
                <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                  {formatClp(sumaCosto)}
                </td>
              )}
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

/* Tarjeta de un desembolso de la planilla (Impuestos F29 / Imposiciones Previred).
   `value === null` = el conector aún no lo expone → se muestra "En preparación"
   (NO $0, que se leería como "nada que pagar"). */
function Metric({ label, value, help }: { label: string; value: number | null; help?: string }) {
  const pending = value === null;
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">{label}</p>
      <p
        className={
          "mt-1 text-lg font-semibold tabular-nums " +
          (pending ? "text-neutral-mid/70" : "text-neutral-dark")
        }
      >
        {pending ? "En preparación" : formatClp(value)}
      </p>
      {help && <p className="mt-1 text-[11px] leading-snug text-neutral-mid">{help}</p>}
    </div>
  );
}
