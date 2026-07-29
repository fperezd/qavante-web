"use client";

import * as React from "react";
import { ShieldCheck, Users, CalendarClock, ExternalLink } from "lucide-react";
import { QavanteCard, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useBukPayroll } from "@/lib/api/buk";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { presetRange, type PeriodRange } from "@/lib/period/period-range";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { formatDateLike } from "@/lib/formatters/date";
import { formatClp } from "@/lib/formatters/clp";
import { PreviredEstadoConexion } from "@/components/credenciales/previred-estado-conexion";
import { vencimientoPrevired } from "./previred-vencimiento";

/* Previred (Fase 2, pedido de Fernando 2026-07-28) — bucket propio en Pagar: las
   IMPOSICIONES del mes (cotizaciones previsionales) que se enteran en Previred.
   El MONTO es el `total_cotizaciones` de la planilla de BUK (ADR-0070, el mismo
   que la obligación de imposiciones del hero de Pagar). El VENCIMIENTO es el día
   13 del mes siguiente (Previred electrónico, ver `previred-vencimiento`). No
   mostramos "pagado/no pagado": el estado de pago del scraping de Previred no está
   resuelto (faltante ≠ 0) → surface honesto (monto a pagar + link para pagarlo),
   no un estado inventado. */

export function PreviredView() {
  const [range, setRange] = React.useState<PeriodRange>(() => presetRange("mes_actual"));
  const period = range.hasta;
  const payroll = useBukPayroll({ period: period ?? "" });
  const totales = payroll.data?.totales;
  const monto = totales?.total_cotizaciones ?? 0;
  const empleados = totales?.empleados_contados ?? 0;
  const vence = period ? vencimientoPrevired(period) : null;

  return (
    <div className="space-y-4">
      <PeriodRangeFilter
        value={range}
        onChange={setRange}
        hint="Las imposiciones se pagan por mes (el mes final del rango)."
      />

      {payroll.isError ? (
        <QavanteInlineError error={payroll.error} what="las imposiciones de Previred" />
      ) : payroll.isFetching && !totales ? (
        <div
          className="h-40 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label="Cargando imposiciones"
        />
      ) : monto <= 0 ? (
        <QavanteEmpty
          icon={ShieldCheck}
          title="Sin imposiciones en el período"
          description="No hay planilla con cotizaciones para este mes. Prueba con otro período. El monto se toma de tu planilla (BUK)."
        />
      ) : (
        <QavanteCard
          variant="bordered"
          header={
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              <span className="font-medium">Imposiciones · Previred</span>
            </div>
          }
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
                {formatPeriodLabel(period)}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-dark">
                {formatClp(monto)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-mid">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {empleados} {empleados === 1 ? "trabajador" : "trabajadores"}
                </span>
                {vence && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    Vence el {formatDateLike(vence)} (Previred electrónico)
                  </span>
                )}
              </div>
            </div>
            <a
              href="https://www.previred.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-brand-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              Pagar en Previred
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </QavanteCard>
      )}

      <PreviredEstadoConexion />

      <p className="text-xs text-neutral-mid">
        El monto sale de tu planilla en BUK — cotizaciones de AFP, salud y seguro de cesantía. El
        pago se realiza en Previred (no leemos aún si ya está pagado).
      </p>
    </div>
  );
}
