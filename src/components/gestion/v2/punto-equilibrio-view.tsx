"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Calendar, Target } from "lucide-react";
import { QavanteInlineError } from "@/components/qavante";
import { useOperationalResultBreakdown } from "@/lib/api/gestion";
import { addMonths } from "@/lib/period/period-range";
import { formatClp } from "@/lib/formatters/clp";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { computePuntoEquilibrio, type PuntoEquilibrio } from "./punto-equilibrio-model";

/* Gestión → Punto de equilibrio v2 (pedido de Fernando 2026-07-30, redefinido 2026-07-31). Dato
   CONCRETO, no proyección ni %: "el mes pasado gastaste X; si gastas lo mismo, necesitas vender X
   para no perder". El piso = lo que gastaste el ÚLTIMO MES CERRADO (completo), sumando tus costos
   recurrentes reales. No se usa el mes en curso (incompleto) → se acaba el "arriendo de julio en
   blanco". Excluye lo "sin clasificar". Sin `export const runtime` (regla 4). */

function periodoMenos(period: string, n: number): string {
  return addMonths(period, -n);
}

export function PuntoEquilibrioView({ initialPeriod }: { initialPeriod: string }) {
  const [period, setPeriod] = React.useState(initialPeriod);
  const months = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => periodoMenos(initialPeriod, i)),
    [initialPeriod],
  );
  // Traemos unos meses de contexto; el modelo ancla en el último CERRADO (previo al en curso).
  const from = periodoMenos(period, 3);
  const bd = useOperationalResultBreakdown(from, period);

  const pe = React.useMemo(() => (bd.data ? computePuntoEquilibrio(bd.data) : null), [bd.data]);

  return (
    <div className="space-y-5">
      <MonthPicker value={period} onChange={setPeriod} months={months} />

      {bd.isError ? (
        <QavanteInlineError error={bd.error} what="el punto de equilibrio" />
      ) : bd.isFetching && !bd.data ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />
      ) : !pe || pe.lineas.length === 0 ? (
        <SinDato />
      ) : (
        <>
          <Hero pe={pe} />
          <TablaRecurrentes pe={pe} />
          <p className="text-[11px] text-neutral-light">
            Tomamos lo que gastaste el <b>último mes cerrado ({formatPeriodLabel(pe.mes)})</b>, que
            está completo; el mes en curso no se usa porque puede estar a medio clasificar.
            Excluimos lo “sin clasificar”. El IVA no cuenta (es un pasa-manos).
          </p>
        </>
      )}
    </div>
  );
}

function Hero({ pe }: { pe: PuntoEquilibrio }) {
  const piso = pe.totalACubrir;
  // Dato concreto: comparamos el piso contra lo que vendiste ESE MISMO mes cerrado.
  const ingresos = pe.ingresoMes;
  const gap = ingresos - piso;
  const arriba = gap >= 0;
  const Icon = arriba ? ArrowUpRight : ArrowDownRight;
  const mesLabel = formatPeriodLabel(pe.mes);
  return (
    <section
      className={`rounded-xl border p-5 ${
        arriba
          ? "border-success-700/30 bg-success-700/[.06]"
          : "border-warning-500/40 bg-warning-500/[.06]"
      }`}
    >
      <div className="flex items-start gap-3">
        <Target
          className={`mt-0.5 h-5 w-5 shrink-0 ${arriba ? "text-success-700" : "text-warning-700"}`}
          aria-hidden="true"
        />
        <div>
          <p className="text-base font-bold text-neutral-dark">
            Si gastas como el mes pasado, necesitas vender {formatClp(Math.round(piso))} al mes para
            no perder
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-neutral-mid">
            <Icon
              className={`h-4 w-4 ${arriba ? "text-success-700" : "text-danger-500"}`}
              aria-hidden="true"
            />
            {ingresos > 0
              ? arriba
                ? `En ${mesLabel} gastaste ${formatClp(Math.round(piso))} y vendiste ${formatClp(ingresos)} — ${formatClp(gap)} sobre tu piso.`
                : `En ${mesLabel} gastaste ${formatClp(Math.round(piso))} y vendiste ${formatClp(ingresos)} — ${formatClp(Math.abs(gap))} bajo tu piso.`
              : `Es lo que gastaste en costos recurrentes en ${mesLabel}.`}
          </p>
        </div>
      </div>
    </section>
  );
}

function TablaRecurrentes({ pe }: { pe: PuntoEquilibrio }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-bold text-neutral-dark">
        Lo que gastaste en {formatPeriodLabel(pe.mes)}
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-neutral-mid">
              <th className="py-1 pr-3 text-left font-semibold">Línea</th>
              <th className="py-1 pl-3 text-right font-semibold text-neutral-dark">Gastaste</th>
            </tr>
          </thead>
          <tbody>
            {pe.lineas.map((l, i) => (
              <tr key={`${l.label}-${i}`} className="border-t border-border/60">
                <td className="py-1.5 pr-3 text-neutral-dark">{l.label}</td>
                <td className="py-1.5 pl-3 text-right font-semibold tabular-nums text-neutral-dark">
                  {formatClp(Math.round(l.monto))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong">
              <td className="py-2 pr-3 font-bold text-neutral-dark">Total a cubrir</td>
              <td className="py-2 pl-3 text-right font-bold tabular-nums text-neutral-dark">
                {formatClp(Math.round(pe.totalACubrir))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function SinDato() {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 text-sm text-neutral-mid">
      Todavía no hay un mes cerrado con costos clasificados para calcular tu punto de equilibrio.
    </section>
  );
}

function MonthPicker({
  value,
  onChange,
  months,
}: {
  value: string;
  onChange: (m: string) => void;
  months: string[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm">
      <Calendar className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
      <span className="sr-only">Mes</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-medium text-neutral-dark focus-visible:outline-none"
        aria-label="Elegir mes"
      >
        {months.map((mo) => (
          <option key={mo} value={mo}>
            {formatPeriodLabel(mo)}
          </option>
        ))}
      </select>
    </label>
  );
}
