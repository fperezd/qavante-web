"use client";

import * as React from "react";
import Link from "next/link";
import { Banknote, Plus } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useDashboardSummary } from "@/lib/api/dashboard";
import {
  defaultCashFlowRange,
  useCashFlowReport,
  type CashFlowBucket,
  type CashFlowGranularity,
} from "@/lib/api/treasury-reports";
import { useCashMinimum } from "@/lib/api/cash-minimum";
import { parseAmount } from "@/components/inicio/dashboard-format";
import { formatClp } from "@/lib/formatters/clp";
import { CajaV2Resumen, type CajaMovible } from "./caja-v2-resumen";
import { CajaHero } from "./caja-hero";
import { SaldoPorBanco } from "./saldo-por-banco";
import { CajaCurva } from "./caja-curva";
import { serieAnclada, cajaMinimoCLP, flujoDeBuckets, primerCruceFuturo } from "./caja-v2-map";
import { formatBucketLabel } from "@/components/caja/cash-flow-format";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { orderRange, type PeriodRange } from "@/lib/period/period-range";
import { type SaldoPunto } from "./caja-curva-model";

/* Vista LIVE de la pestaña "Resumen" de Caja v2 (rediseño 2026-07-14), gated por `cajaV2`
   (OFF). Orquesta dashboard (saldo hoy + runway) + reporte de caja (netos → la curva
   derivada) + caja mínima, y compone `CajaV2Resumen`. Degradado honesto: la curva se
   deriva del saldo + netos (el backend aún no manda running_balance/min_cash); el saldo
   por banco degrada al total (bice/saldo es api-key-only) hasta que CC-API lo cookie-gatee.
   Container: NO se testea por Storybook play (ADR-0018); la lógica vive en `caja-v2-map`. */

export function CajaV2ResumenLive() {
  // Selector de RANGO — el estándar de la app (`PeriodRangeFilter`, con presets Mes actual / Tres
  // meses / Este año…), el mismo que usan Gestión y el Libro. El v2 había metido un selector
  // ad-hoc del cash-flow clásico; se unifica al estándar. La granularidad queda en "week" (la curva
  // se arma por semana) y la capa en "committed"; el usuario elige el RANGO.
  const [range, setRange] = React.useState<PeriodRange>(() => {
    const d = defaultCashFlowRange();
    return { desde: d.period_from, hasta: d.period_to };
  });
  const dash = useDashboardSummary();
  const ordered = orderRange(range);
  const cf = useCashFlowReport({
    period_from: ordered.desde,
    period_to: ordered.hasta,
    granularity: "week",
    financial_layer: "committed",
  });
  const cm = useCashMinimum();

  return (
    <div className="space-y-4">
      <PeriodRangeFilter
        value={range}
        onChange={setRange}
        hint="El rango define el período; la curva muestra la evolución del saldo."
      />
      <CajaV2Contenido dash={dash} cf={cf} cm={cm} granularity="week" />
    </div>
  );
}

/** Contenido de la Caja v2 (skeleton / error / datos). Separado del selector para que éste NO
 *  desaparezca durante la recarga al cambiar de período. */
function CajaV2Contenido({
  dash,
  cf,
  cm,
  granularity,
}: {
  dash: ReturnType<typeof useDashboardSummary>;
  cf: ReturnType<typeof useCashFlowReport>;
  cm: ReturnType<typeof useCashMinimum>;
  granularity: CashFlowGranularity;
}) {
  if (cf.isLoading || dash.isLoading) return <LiveSkeleton />;
  if (cf.isError) {
    return <QavanteInlineError error={cf.error} what="el reporte de caja" onRetry={() => cf.refetch()} />;
  }

  const allBuckets = (cf.data?.buckets ?? []) as CashFlowBucket[];
  // `cash_today` es un bloque NULLABLE del summary (banco no conectado / fuente caída / 500 del
  // dashboard). Faltante ≠ 0 (§13): NO colapsamos un saldo desconocido a $0 "en negativo".
  const cashTotal = dash.data?.cash_today?.total;
  const saldoConocido = cashTotal != null;
  const saldoHoy = parseAmount(cashTotal);
  if (!saldoConocido && allBuckets.length === 0) return <EmptyState />;

  // Sin saldo base: mostramos honestamente los flujos conocidos del período, sin inventar saldo/curva.
  // Si el saldo falta por un ERROR del dashboard (no porque el banco esté sin conectar), el copy lo dice
  // (§13 / no ocultar un error como dato faltante).
  if (!saldoConocido)
    return <SinSaldoBase buckets={allBuckets} granularity={granularity} saldoError={dash.isError} />;

  // La curva muestra la TRAYECTORIA del saldo sobre el rango, anclada en el saldo de hoy: reconstruye
  // los períodos pasados hacia atrás y proyecta los futuros hacia adelante (sin doble conteo). Un
  // punto por período; el FLUJO agrega el total del rango (allBuckets).
  const now = new Date();
  const serie = serieAnclada(saldoHoy, allBuckets, granularity, now, (p) => formatBucketLabel(p, granularity));
  const minimo = cajaMinimoCLP(cm.data);
  // El cruce "bajo el mínimo" cuenta solo DESDE HOY hacia adelante: un dip reconstruido en un
  // período ya pasado no es accionable (no se puede adelantar cobranza para una semana que terminó).
  const cruceIdx = primerCruceFuturo(serie, allBuckets, granularity, now, minimo);
  const dias = dash.data?.cash_forecast?.days_of_cash ?? null;
  // Caja en cero o negativa → tono crítico honesto (no un ✓ verde "alcanza ~0 días").
  const negativa = saldoHoy <= 0;
  const tono = negativa ? "crit" : cruceIdx != null ? "warn" : "ok";

  return (
    <CajaV2Resumen
      hero={
        <CajaHero
          titulo="La empresa tiene en caja"
          saldo={saldoHoy}
          runway={negativa ? runwayNegativo(saldoHoy) : buildRunway(serie, cruceIdx, minimo, dias)}
          runwayTono={tono}
          subtitulo="Saldo hoy en caja"
          infoHint="Saldo de tus cuentas hoy. La curva proyecta este saldo + las entradas y salidas esperadas del reporte de caja."
        />
      }
      bancos={
        // Degradado: el banco SÍ está conectado (es la fuente del saldo), pero el detalle POR
        // CUENTA no llega porque bice/saldo es api-key-only. Total + aviso honesto (no "conecta tu
        // banco", que sería falso: ya está conectado).
        <SaldoPorBanco
          titulo="Saldo disponible"
          bancos={[]}
          total={saldoHoy}
          totalLabel="Total en caja hoy"
          nota="El saldo por cada cuenta todavía no está disponible"
        />
      }
      flujo={<FlujoBlock flujo={flujoDeBuckets(allBuckets)} minimo={minimo} />}
      curva={<CurvaCard serie={serie} minimo={minimo} cruceIdx={cruceIdx} />}
      movibles={
        // Tabla del período (allBuckets); el "saldo al cierre" usa la trayectoria anclada (serie[i]).
        allBuckets.length > 0 ? buildMovibles(allBuckets, serie, granularity) : []
      }
    />
  );
}

function runwayNegativo(saldo: number): React.ReactNode {
  if (saldo === 0) return "Sin caja disponible hoy · 0 días de caja.";
  return "Tu caja está hoy en negativo · 0 días de caja.";
}

function buildRunway(
  serie: SaldoPunto[],
  cruceIdx: number | null,
  minimo: number | null,
  dias: number | null,
): React.ReactNode {
  if (cruceIdx != null) {
    return (
      <>
        El <b>{serie[cruceIdx]?.label}</b> la caja cae bajo tu mínimo
        {minimo != null ? ` (${formatClp(minimo)})` : ""}.
      </>
    );
  }
  if (dias != null) return `Alcanza ~${dias} días con la caja actual.`;
  return "La caja cubre el período proyectado.";
}

function FlujoBlock({ flujo, minimo }: { flujo: { entra: number; sale: number; neto: number }; minimo: number | null }) {
  const { entra, sale, neto } = flujo;
  const row = (k: string, v: string, tono?: string) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5 first:border-t-0">
      <dt className="text-neutral-mid">{k}</dt>
      <dd className={`font-bold tabular-nums ${tono ?? "text-neutral-dark"}`}>{v}</dd>
    </div>
  );
  return (
    <div className="p-5">
      <dl className="flex flex-col text-[13px]">
        {row("Entra (período)", formatClp(entra), "text-success-700")}
        {row("Sale (período)", formatClp(-Math.abs(sale)), "text-danger-500")}
        {row("Neto del período", formatClp(neto), neto < 0 ? "text-danger-500" : "text-neutral-dark")}
        {minimo != null && row("Tu caja mínima", formatClp(minimo))}
      </dl>
    </div>
  );
}

function CurvaCard({
  serie,
  minimo,
  cruceIdx,
}: {
  serie: SaldoPunto[];
  minimo: number | null;
  cruceIdx: number | null;
}) {
  const eventos = cruceIdx != null ? [{ indice: cruceIdx, label: "Bajo el mínimo", tono: "crit" as const }] : [];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-dark">Saldo proyectado</h2>
      </div>
      <div className="px-3 py-3">
        {serie.length < 2 ? (
          <p className="px-2 py-8 text-center text-[13px] text-neutral-mid">
            Elige un rango con al menos dos períodos para ver la evolución del saldo.
          </p>
        ) : (
          <CajaCurva serie={serie} minimo={minimo} eventos={eventos} />
        )}
      </div>
      {cruceIdx != null && (
        <p className="mx-4 mb-4 rounded-lg border border-danger-500/30 bg-danger-500/[.06] px-3 py-2 text-[13px] text-neutral-dark">
          El <b>{serie[cruceIdx]?.label}</b> la caja cae bajo tu mínimo.{" "}
          <Link href="/cobrar" className="rounded font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
            Adelanta una cobranza
          </Link>{" "}
          o{" "}
          <Link href="/pagar" className="rounded font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
            posterga un pago
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/** Tabla de entradas/salidas por período. Con `serie` (la trayectoria anclada) agrega la columna
 *  SALDO AL CIERRE — el saldo al cierre del bucket i = serie[i]; sin `serie` (no hay saldo base
 *  conocido) omite esa columna en vez de inventar un cierre desde $0. */
function FlowsTable({
  buckets,
  serie,
  granularity,
}: {
  buckets: CashFlowBucket[];
  serie?: SaldoPunto[];
  granularity: CashFlowGranularity;
}) {
  const conCierre = serie != null;
  const cols = conCierre ? ["Período", "Entra", "Sale", "Neto", "Saldo al cierre"] : ["Período", "Entra", "Sale", "Neto"];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-dark">Entradas y salidas · por período</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] tabular-nums">
          <thead>
            <tr>
              {cols.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-2 text-[10.5px] font-bold uppercase tracking-wide text-neutral-mid ${i === 0 ? "text-left" : "text-right"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b, i) => (
              <tr key={`${b.period}-${i}`} className="border-t border-border">
                <td className="px-4 py-2 text-[13px]">{formatBucketLabel(b.period, granularity)}</td>
                <td className="px-4 py-2 text-right text-[13px] text-success-700">{formatClp(parseAmount(b.total_inflow))}</td>
                <td className="px-4 py-2 text-right text-[13px] text-danger-500">
                  {formatClp(-Math.abs(parseAmount(b.total_outflow)))}
                </td>
                <td className="px-4 py-2 text-right text-[13px]">{formatClp(parseAmount(b.net))}</td>
                {conCierre && (
                  <td className="px-4 py-2 text-right text-[13px] font-bold">{formatClp(serie![i]?.saldo ?? 0)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildMovibles(
  buckets: CashFlowBucket[],
  serie: SaldoPunto[] | undefined,
  granularity: CashFlowGranularity,
): CajaMovible[] {
  return [
    {
      id: "flujo-semanal",
      label: "Entradas y salidas",
      node: <FlowsTable buckets={buckets} serie={serie} granularity={granularity} />,
    },
  ];
}

/** Panel honesto cuando NO hay saldo base conocido (banco no conectado / dashboard sin dato):
 *  muestra los flujos que sí conocemos (del reporte de caja) y pide conectar el banco, en vez
 *  de renderear un saldo "$0 en negativo" o una curva proyectada desde cero (§13). */
function SinSaldoBase({
  buckets,
  granularity,
  saldoError = false,
}: {
  buckets: CashFlowBucket[];
  granularity: CashFlowGranularity;
  /** El saldo falta por un ERROR del dashboard, no porque el banco esté sin conectar. Copy honesto
   *  distinto (no "conecta tu banco", que sería falso). */
  saldoError?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm sm:grid sm:grid-cols-2">
        <div className="p-5">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">La empresa tiene en caja</p>
          <p className="mt-1.5 text-[22px] font-bold text-neutral-mid">Sin dato de saldo</p>
          {saldoError ? (
            <p className="mt-3 inline-flex items-start gap-1.5 text-[13px] font-semibold text-warning-700">
              <Plus className="mt-px size-4 shrink-0 rotate-45" aria-hidden="true" />
              No pudimos traer tu saldo ahora (hubo un error). Reintentá en un momento.
            </p>
          ) : (
            <p className="mt-3 inline-flex items-start gap-1.5 text-[13px] font-semibold text-brand-primary">
              <Plus className="mt-px size-4 shrink-0" aria-hidden="true" />
              Conecta tu banco para ver tu saldo real y proyectar tu caja.
            </p>
          )}
          <p className="mt-2.5 text-[12.5px] text-neutral-mid">
            El flujo de acá abajo (entradas y salidas) sí viene de tus movimientos.
          </p>
        </div>
        <div className="border-t border-border sm:border-l sm:border-t-0">
          <FlujoBlock flujo={flujoDeBuckets(buckets)} minimo={null} />
        </div>
      </div>
      <FlowsTable buckets={buckets} granularity={granularity} />
    </div>
  );
}

function LiveSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-28 animate-pulse rounded-xl bg-surface-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
      <span className="sr-only">Cargando tu caja…</span>
    </div>
  );
}

function EmptyState() {
  return (
    <QavanteEmpty
      icon={Banknote}
      title="Aún no hay datos de caja"
      description="Conecta tu banco y el SII para ver tu saldo, la proyección y cuándo la caja toca su mínimo."
    />
  );
}
