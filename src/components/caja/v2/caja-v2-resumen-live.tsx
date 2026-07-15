"use client";

import * as React from "react";
import { Banknote, Plus } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useDashboardSummary } from "@/lib/api/dashboard";
import { defaultCashFlowRange, useCashFlowReport, type CashFlowBucket } from "@/lib/api/treasury-reports";
import { useCashMinimum } from "@/lib/api/cash-minimum";
import { parseAmount } from "@/components/inicio/dashboard-format";
import { formatClp } from "@/lib/formatters/clp";
import { CajaV2Resumen, type CajaMovible } from "./caja-v2-resumen";
import { CajaHero } from "./caja-hero";
import { SaldoPorBanco } from "./saldo-por-banco";
import { CajaCurva } from "./caja-curva";
import { serieDesdeCashFlow, cajaMinimoCLP, labelBucketCorto } from "./caja-v2-map";
import { primerCruce, type SaldoPunto } from "./caja-curva-model";

/* Vista LIVE de la pestaña "Resumen" de Caja v2 (rediseño 2026-07-14), gated por `cajaV2`
   (OFF). Orquesta dashboard (saldo hoy + runway) + reporte de caja (netos → la curva
   derivada) + caja mínima, y compone `CajaV2Resumen`. Degradado honesto: la curva se
   deriva del saldo + netos (el backend aún no manda running_balance/min_cash); el saldo
   por banco degrada al total (bice/saldo es api-key-only) hasta que CC-API lo cookie-gatee.
   Container: NO se testea por Storybook play (ADR-0018); la lógica vive en `caja-v2-map`. */

export function CajaV2ResumenLive() {
  const dash = useDashboardSummary();
  const cf = useCashFlowReport({
    ...defaultCashFlowRange(),
    granularity: "week",
    financial_layer: "committed",
  });
  const cm = useCashMinimum();

  if (cf.isLoading || dash.isLoading) return <LiveSkeleton />;
  if (cf.isError) {
    return <QavanteInlineError error={cf.error} what="el reporte de caja" onRetry={() => cf.refetch()} />;
  }

  const buckets = (cf.data?.buckets ?? []) as CashFlowBucket[];
  // `cash_today` es un bloque NULLABLE del summary (banco no conectado / fuente caída / 500 del
  // dashboard). Faltante ≠ 0 (§13): NO colapsamos un saldo desconocido a $0 "en negativo".
  const cashTotal = dash.data?.cash_today?.total;
  const saldoConocido = cashTotal != null;
  const saldoHoy = parseAmount(cashTotal);
  if (!saldoConocido && buckets.length === 0) return <EmptyState />;

  // Sin saldo base: mostramos honestamente los flujos conocidos, sin inventar un saldo/curva.
  if (!saldoConocido) return <SinSaldoBase cf={cf.data} buckets={buckets} />;

  const serie = serieDesdeCashFlow(saldoHoy, buckets, labelBucketCorto);
  const minimo = cajaMinimoCLP(cm.data);
  const cruceIdx = minimo != null ? primerCruce(serie.map((s) => s.saldo), minimo) : null;
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
          subtitulo={negativa ? "Saldo hoy. Conecta tu banco para confirmar el saldo real por cuenta" : "Saldo hoy en caja"}
          infoHint="Saldo de tus cuentas hoy. La curva proyecta este saldo + las entradas y salidas esperadas del reporte de caja."
        />
      }
      bancos={
        // Degradado: sin el detalle por banco (bice/saldo es api-key-only), se muestra el total
        // + un aviso honesto para conectar el banco.
        <SaldoPorBanco
          titulo="Saldo disponible"
          bancos={[]}
          total={saldoHoy}
          totalLabel="Total en caja hoy"
          nota="Conecta tu banco para ver el saldo por cuenta"
        />
      }
      flujo={<FlujoBlock cf={cf.data} minimo={minimo} />}
      curva={<CurvaCard serie={serie} minimo={minimo} cruceIdx={cruceIdx} />}
      movibles={buildMovibles(buckets, serie)}
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

function FlujoBlock({ cf, minimo }: { cf: ReturnType<typeof useCashFlowReport>["data"]; minimo: number | null }) {
  const gt = cf?.grand_total;
  const entra = parseAmount(gt?.inflow);
  const sale = parseAmount(gt?.outflow);
  const neto = parseAmount(gt?.net);
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
          <p className="px-2 py-8 text-center text-xs text-neutral-mid">
            Aún no hay suficientes períodos para proyectar la curva de saldo.
          </p>
        ) : (
          <CajaCurva serie={serie} minimo={minimo} eventos={eventos} />
        )}
      </div>
      {cruceIdx != null && (
        <p className="mx-4 mb-4 rounded-lg border border-danger-500/30 bg-danger-500/[.06] px-3 py-2 text-[13px] text-neutral-dark">
          El <b>{serie[cruceIdx]?.label}</b> la caja cae bajo tu mínimo. Adelanta una cobranza o posterga un pago.
        </p>
      )}
    </div>
  );
}

/** Tabla de entradas/salidas por período. Con `serie` agrega la columna SALDO AL CIERRE
 *  (saldo al cierre del bucket i = serie[i+1], serie[0] es "hoy"); sin `serie` (no hay saldo
 *  base conocido) omite esa columna en vez de inventar un cierre desde $0. */
function FlowsTable({ buckets, serie }: { buckets: CashFlowBucket[]; serie?: SaldoPunto[] }) {
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
                <td className="px-4 py-2 text-[13px]">{labelBucketCorto(b.period)}</td>
                <td className="px-4 py-2 text-right text-[13px] text-success-700">{formatClp(parseAmount(b.total_inflow))}</td>
                <td className="px-4 py-2 text-right text-[13px] text-danger-500">
                  {formatClp(-Math.abs(parseAmount(b.total_outflow)))}
                </td>
                <td className="px-4 py-2 text-right text-[13px]">{formatClp(parseAmount(b.net))}</td>
                {conCierre && (
                  <td className="px-4 py-2 text-right text-[13px] font-bold">{formatClp(serie![i + 1]?.saldo ?? 0)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildMovibles(buckets: CashFlowBucket[], serie: SaldoPunto[]): CajaMovible[] {
  return [{ id: "flujo-semanal", label: "Entradas y salidas", node: <FlowsTable buckets={buckets} serie={serie} /> }];
}

/** Panel honesto cuando NO hay saldo base conocido (banco no conectado / dashboard sin dato):
 *  muestra los flujos que sí conocemos (del reporte de caja) y pide conectar el banco, en vez
 *  de renderear un saldo "$0 en negativo" o una curva proyectada desde cero (§13). */
function SinSaldoBase({ cf, buckets }: { cf: ReturnType<typeof useCashFlowReport>["data"]; buckets: CashFlowBucket[] }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm sm:grid sm:grid-cols-2">
        <div className="p-5">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">La empresa tiene en caja</p>
          <p className="mt-1.5 text-[22px] font-bold text-neutral-mid">Sin dato de saldo</p>
          <p className="mt-3 inline-flex items-start gap-1.5 text-[13px] font-semibold text-brand-primary">
            <Plus className="mt-px size-4 shrink-0" aria-hidden="true" />
            Conecta tu banco para ver tu saldo real y proyectar tu caja.
          </p>
          <p className="mt-2.5 text-[12.5px] text-neutral-mid">
            El flujo de acá abajo (entradas y salidas) sí viene de tus movimientos.
          </p>
        </div>
        <div className="border-t border-border sm:border-l sm:border-t-0">
          <FlujoBlock cf={cf} minimo={null} />
        </div>
      </div>
      <FlowsTable buckets={buckets} />
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
