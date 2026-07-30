"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Calendar, Target } from "lucide-react";
import { QavanteBadge, QavanteInlineError, QavanteStatTile } from "@/components/qavante";
import { useOperationalResult, type OperationalResultResponse } from "@/lib/api/gestion";
import { parseAmount } from "../gestion-format";
import { formatClp } from "@/lib/formatters/clp";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { resultadoConfiable } from "./gestion-v2-map";

/* Gestión → Punto de equilibrio (pedido de Fernando 2026-07-29, "las 3"). Responde
   "¿cuánto necesito vender para no perder?". Aproximación honesta y estándar para una
   PYME sin tagging fijo/variable granular: COSTO DE VENTAS = variable (escala con la
   venta), GASTOS (laboral + honorarios + recurrentes) = fijos. Punto de equilibrio =
   costo fijo / margen de contribución. Todo del `operational-result` (ya consumido);
   conserva la guarda de honestidad (margen ≥100% ⇒ no calcular). Sin `export const
   runtime` (regla 4). */

/** Resta n meses a "YYYY-MM". */
function periodoMenos(period: string, n: number): string {
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (!m) return period;
  let y = Number(m[1]);
  let mes = Number(m[2]) - n;
  while (mes <= 0) {
    mes += 12;
    y -= 1;
  }
  return `${y}-${String(mes).padStart(2, "0")}`;
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

interface Equilibrio {
  ingresos: number;
  variable: number;
  fijo: number;
  /** Margen de contribución (0–1): cuánto de cada peso queda para cubrir los fijos. */
  cmr: number;
  /** Punto de equilibrio ($ de venta) o null si no es calculable (cmr ≤ 0). */
  breakeven: number | null;
}

function calcular(r: OperationalResultResponse): Equilibrio {
  const abs = (s: string) => Math.abs(parseAmount(s));
  const ingresos = parseAmount(r.revenue);
  const variable = abs(r.direct_cost);
  const fijo = abs(r.labor_cost) + abs(r.professional_fees) + abs(r.recurring_expenses);
  const cmr = ingresos > 0 ? (ingresos - variable) / ingresos : 0;
  const breakeven = cmr > 0 ? fijo / cmr : null;
  return { ingresos, variable, fijo, cmr, breakeven };
}

export function PuntoEquilibrioView({ initialPeriod }: { initialPeriod: string }) {
  const [period, setPeriod] = React.useState(initialPeriod);
  const months = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => periodoMenos(initialPeriod, i)),
    [initialPeriod],
  );
  const cur = useOperationalResult(period);

  return (
    <div className="space-y-5">
      <MonthPicker value={period} onChange={setPeriod} months={months} />

      {cur.isError ? (
        <QavanteInlineError error={cur.error} what="el punto de equilibrio" />
      ) : cur.isFetching && !cur.data ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />
      ) : cur.data && !resultadoConfiable(cur.data) ? (
        <NoConfiable />
      ) : cur.data ? (
        <Contenido eq={calcular(cur.data)} mes={cur.data} />
      ) : null}
    </div>
  );
}

function Contenido({ eq, mes }: { eq: Equilibrio; mes: OperationalResultResponse }) {
  return (
    <>
      <Hero eq={eq} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QavanteStatTile
          label="Punto de equilibrio"
          value={eq.breakeven == null ? "—" : formatClp(Math.round(eq.breakeven))}
          tone="default"
          hint="Venta mensual con la que no ganas ni pierdes."
        />
        <QavanteStatTile
          label="Vas en"
          value={formatClp(eq.ingresos)}
          tone="default"
          hint="Tus ingresos de este mes."
        />
        <QavanteStatTile
          label="Margen de contribución"
          value={fmtPct(eq.cmr * 100)}
          tone={eq.cmr > 0 ? "success" : "danger"}
          hint="De cada $100 de venta, lo que queda para cubrir tus costos fijos."
        />
      </div>

      <Composicion eq={eq} />

      <p className="text-[11px] text-neutral-light">
        Aproximación: tratamos el <b>costo de ventas</b> como variable y los <b>gastos</b> (laboral,
        honorarios, recurrentes) como fijos. Sirve para dimensionar el piso de venta, no como cierre
        contable.
      </p>

      <ConfianzaPie mes={mes} />
    </>
  );
}

function Hero({ eq }: { eq: Equilibrio }) {
  if (eq.breakeven == null) {
    return (
      <section className="rounded-xl border border-warning-500/40 bg-warning-500/[.06] p-5 text-[13px]">
        <p className="font-bold text-warning-700">No podemos calcular tu punto de equilibrio</p>
        <p className="mt-1 text-neutral-dark">
          Tu costo de ventas iguala o supera tus ingresos del mes, así que cada venta no deja aporte
          para cubrir los costos fijos. Revisa el costo de ventas en <b>Márgenes</b>.
        </p>
      </section>
    );
  }
  const gap = eq.ingresos - eq.breakeven;
  const arriba = gap >= 0;
  const Icon = arriba ? ArrowUpRight : ArrowDownRight;
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
            Necesitas vender {formatClp(Math.round(eq.breakeven))} al mes para no perder
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-neutral-mid">
            <Icon
              className={`h-4 w-4 ${arriba ? "text-success-700" : "text-danger-500"}`}
              aria-hidden="true"
            />
            {arriba
              ? `Vas en ${formatClp(eq.ingresos)} — tienes ${formatClp(gap)} de colchón sobre tu piso.`
              : `Vas en ${formatClp(eq.ingresos)} — te faltan ${formatClp(Math.abs(gap))} de venta para no perder.`}
          </p>
        </div>
      </div>
    </section>
  );
}

function Composicion({ eq }: { eq: Equilibrio }) {
  const varPorCien = Math.round((1 - eq.cmr) * 100);
  const fila = (label: string, valor: string) => (
    <div className="flex items-center justify-between border-t border-dashed border-border py-1.5 text-sm">
      <span className="text-neutral-mid">{label}</span>
      <span className="font-semibold tabular-nums text-neutral-dark">{valor}</span>
    </div>
  );
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-bold text-neutral-dark">Cómo se compone</h2>
      {fila("Costo fijo mensual (a cubrir)", formatClp(eq.fijo))}
      {fila("Costo variable por cada $100 de venta", `${formatClp(varPorCien)}`)}
      {fila("Aporte por cada $100 de venta", formatClp(Math.round(eq.cmr * 100)))}
    </section>
  );
}

const CONF_LABEL = {
  high: "Confianza alta",
  medium: "Confianza media",
  low: "Confianza baja",
} as const;
const CONF_VARIANT = { high: "success", medium: "warning", low: "danger" } as const;

function ConfianzaPie({ mes }: { mes: OperationalResultResponse }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-neutral-mid">
      <span className="font-medium text-neutral-dark">Confianza de este dato:</span>
      <QavanteBadge variant={CONF_VARIANT[mes.confidence]}>
        {CONF_LABEL[mes.confidence]}
      </QavanteBadge>
      {(mes.missing_sources ?? []).length > 0 && (
        <span>Faltan fuentes: {(mes.missing_sources ?? []).join(", ")} (no se asumen en cero)</span>
      )}
    </div>
  );
}

function NoConfiable() {
  return (
    <section className="rounded-xl border border-warning-500/40 bg-warning-500/[.06] p-5 text-[13px]">
      <p className="font-bold text-warning-700">No podemos calcular con confianza</p>
      <p className="mt-1 text-neutral-dark">
        El resultado del mes da un margen imposible (≥100%), típicamente un gasto revertido o mal
        clasificado. Está escalado; mira el detalle en <b>Resultado</b>.
      </p>
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
