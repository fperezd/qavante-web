"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Calendar } from "lucide-react";
import { QavanteBadge, QavanteInlineError, QavanteStatTile } from "@/components/qavante";
import {
  useOperationalResult,
  useOperationalResultBreakdown,
  type OperationalResultResponse,
} from "@/lib/api/gestion";
import { parseAmount } from "../gestion-format";
import { formatClp } from "@/lib/formatters/clp";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { resultadoConfiable } from "./gestion-v2-map";
import { mapRangoResumen, type RangoResumen } from "./gestion-v2-rango-map";

/* Comparativo RICO (pedido de Fernando 2026-07-28, "las 5"): además del mes vs
   mes anterior / año anterior, las comparaciones potentes de control de gestión —
   YTD vs año anterior, puente de variación, vs promedio 12m, trimestre móvil y
   eficiencia (márgenes %). Todo del `operational-result` (mes) + `breakdown`
   (totales por rango en 1 request c/u). No toca la vista P&L. Conserva la guarda
   honesta (margen ≥100% ⇒ no mostrar). */

/** Resta n meses a "YYYY-MM" (aritmética pura). */
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

function ymd(period: string): { y: number; m: number } {
  const mm = period.match(/^(\d{4})-(\d{2})/);
  return { y: Number(mm?.[1] ?? 0), m: Number(mm?.[2] ?? 1) };
}

/** Agregado del rango por métrica, vía el mapper canónico del P&L (`mapRangoResumen`), que
   localiza cada fila por key+label+kind (ingresos = /income|ingreso/i, etc.) — NO por `key`
   literal, que en el breakdown no es "revenue" y devolvía 0 (bug del $0 en Ingresos YTD). */
function pick(r: RangoResumen | null, key: string): number {
  if (!r) return 0;
  if (key === "revenue") return r.ingresos;
  if (key === "gross_margin") return r.bruto.monto;
  return r.neto.monto; // result
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Variación % (guardando división por cero). null = sin base para comparar. */
function varPct(actual: number, base: number): number | null {
  if (base === 0) return null;
  return ((actual - base) / Math.abs(base)) * 100;
}

const METRICAS = [
  { key: "revenue", label: "Ingresos" },
  { key: "gross_margin", label: "Margen bruto" },
  { key: "result", label: "Resultado" },
] as const;

export function ComparativoView({ initialPeriod }: { initialPeriod: string }) {
  const [period, setPeriod] = React.useState(initialPeriod);
  const months = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => periodoMenos(initialPeriod, i)),
    [initialPeriod],
  );
  const { y, m } = ymd(period);
  const mm = String(m).padStart(2, "0");

  // Mes actual / anterior / mismo mes año anterior.
  const cur = useOperationalResult(period);
  const prev = useOperationalResult(periodoMenos(period, 1));
  const yoy = useOperationalResult(periodoMenos(period, 12));

  // Rangos (1 request c/u; el `total` de cada fila = el agregado del rango).
  const ytd = useOperationalResultBreakdown(`${y}-01`, period);
  const ytdLy = useOperationalResultBreakdown(`${y - 1}-01`, `${y - 1}-${mm}`);
  const avg12 = useOperationalResultBreakdown(periodoMenos(period, 11), period);
  const qCur = useOperationalResultBreakdown(periodoMenos(period, 2), period);
  const qPrev = useOperationalResultBreakdown(periodoMenos(period, 5), periodoMenos(period, 3));
  const qLy = useOperationalResultBreakdown(periodoMenos(period, 14), periodoMenos(period, 12));

  // Resúmenes por rango (mapper canónico del P&L; memoizados por respuesta).
  const rYtd = React.useMemo(() => (ytd.data ? mapRangoResumen(ytd.data) : null), [ytd.data]);
  const rYtdLy = React.useMemo(
    () => (ytdLy.data ? mapRangoResumen(ytdLy.data) : null),
    [ytdLy.data],
  );
  const rAvg12 = React.useMemo(
    () => (avg12.data ? mapRangoResumen(avg12.data) : null),
    [avg12.data],
  );
  const nAvg12 = avg12.data?.months?.length || 12; // meses reales (|| evita dividir por 0 si viene [])
  const rQCur = React.useMemo(() => (qCur.data ? mapRangoResumen(qCur.data) : null), [qCur.data]);
  const rQPrev = React.useMemo(
    () => (qPrev.data ? mapRangoResumen(qPrev.data) : null),
    [qPrev.data],
  );
  const rQLy = React.useMemo(() => (qLy.data ? mapRangoResumen(qLy.data) : null), [qLy.data]);

  return (
    <div className="space-y-5">
      <MonthPicker value={period} onChange={setPeriod} months={months} />

      {cur.isError ? (
        <QavanteInlineError error={cur.error} what="el comparativo de Gestión" />
      ) : cur.isFetching && !cur.data ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />
      ) : cur.data && !resultadoConfiable(cur.data) ? (
        <NoConfiable />
      ) : cur.data ? (
        <>
          {/* 1) Mes vs mes anterior / año anterior */}
          <Bloque titulo="Este mes" subtitulo={formatPeriodLabel(period)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {METRICAS.map((mt) => {
                const a = parseAmount(cur.data![mt.key]);
                return (
                  <QavanteStatTile
                    key={mt.key}
                    label={mt.label}
                    value={formatClp(a)}
                    tone={a >= 0 ? "default" : "danger"}
                    hint={
                      <span className="flex flex-col gap-0.5">
                        <Delta
                          label="vs mes anterior"
                          v={varPct(a, parseAmount(prev.data?.[mt.key]))}
                        />
                        <Delta
                          label="vs año anterior"
                          v={varPct(a, parseAmount(yoy.data?.[mt.key]))}
                        />
                      </span>
                    }
                  />
                );
              })}
            </div>
          </Bloque>

          {/* 2) Acumulado del año (YTD) vs año anterior */}
          <Bloque
            titulo="Acumulado del año"
            subtitulo={`enero–${formatPeriodLabel(period)} vs mismo tramo ${y - 1}`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {METRICAS.map((mt) => {
                const a = pick(rYtd, mt.key);
                const b = pick(rYtdLy, mt.key);
                return (
                  <QavanteStatTile
                    key={mt.key}
                    label={mt.label}
                    value={formatClp(a)}
                    tone={a >= 0 ? "default" : "danger"}
                    hint={<Delta label={`vs ${y - 1}`} v={varPct(a, b)} />}
                  />
                );
              })}
            </div>
          </Bloque>

          {/* 3) Puente de variación del resultado (vs mes anterior) */}
          {prev.data && (
            <Bloque titulo="Qué explica el cambio del resultado" subtitulo="vs el mes anterior">
              <PuenteVariacion cur={cur.data} prev={prev.data} />
            </Bloque>
          )}

          {/* 4) Este mes vs tu promedio (12 meses) + mismo mes del año anterior (con sus valores) */}
          <Bloque
            titulo="Vs. tu promedio"
            subtitulo={`promedio de los últimos 12 meses y el mismo mes de ${y - 1}`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {METRICAS.map((mt) => {
                const a = parseAmount(cur.data![mt.key]);
                const prom = pick(rAvg12, mt.key) / nAvg12;
                const anioAnt = parseAmount(yoy.data?.[mt.key]);
                return (
                  <QavanteStatTile
                    key={mt.key}
                    label={mt.label}
                    value={formatClp(a)}
                    tone={a >= 0 ? "default" : "danger"}
                    hint={
                      <span className="flex flex-col gap-1">
                        <RefLinea label="promedio 12m" base={prom} actual={a} />
                        <RefLinea label={`mismo mes ${y - 1}`} base={anioAnt} actual={a} />
                      </span>
                    }
                  />
                );
              })}
            </div>
          </Bloque>

          {/* 5) Trimestre móvil (últimos 3 meses) */}
          <Bloque
            titulo="Trimestre (últimos 3 meses)"
            subtitulo="vs trimestre anterior y vs mismo trimestre del año pasado"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {METRICAS.map((mt) => {
                const a = pick(rQCur, mt.key);
                return (
                  <QavanteStatTile
                    key={mt.key}
                    label={mt.label}
                    value={formatClp(a)}
                    tone={a >= 0 ? "default" : "danger"}
                    hint={
                      <span className="flex flex-col gap-0.5">
                        <Delta label="vs trim. anterior" v={varPct(a, pick(rQPrev, mt.key))} />
                        <Delta
                          label="vs mismo trim. año pasado"
                          v={varPct(a, pick(rQLy, mt.key))}
                        />
                      </span>
                    }
                  />
                );
              })}
            </div>
          </Bloque>

          {/* 6) Eficiencia (márgenes %) */}
          <Bloque
            titulo="Eficiencia"
            subtitulo="cuánto ganás por cada peso vendido (no solo cuánto)"
          >
            <Eficiencia cur={cur.data} prev={prev.data} yoy={yoy.data} />
          </Bloque>

          <ConfianzaPie mes={cur.data} />
        </>
      ) : null}
    </div>
  );
}

/* ---------- Bloques auxiliares ---------- */
function Bloque({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-bold text-neutral-dark">{titulo}</h2>
        <p className="text-xs text-neutral-mid">{subtitulo}</p>
      </div>
      {children}
    </section>
  );
}

/** Línea de referencia: "label $valor  ±%". Muestra el VALOR de la referencia (no solo el %). */
function RefLinea({ label, base, actual }: { label: string; base: number; actual: number }) {
  const v = varPct(actual, base);
  const up = (v ?? 0) >= 0;
  const color = v == null ? "text-neutral-light" : up ? "text-success-700" : "text-danger-500";
  return (
    <span className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-neutral-mid">
        {label} <b className="tabular-nums text-neutral-dark">{formatClp(base)}</b>
      </span>
      <span className={`shrink-0 font-medium ${color}`}>
        {v == null ? "sin base" : `${up ? "+" : ""}${v.toFixed(1)}%`}
      </span>
    </span>
  );
}

function Delta({ label, v }: { label: string; v: number | null }) {
  if (v === null) return <span className="text-[11px] text-neutral-light">{label}: sin base</span>;
  const up = v >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const color = up ? "text-success-700" : "text-danger-500";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${color}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}: {up ? "+" : ""}
      {v.toFixed(1)}%
    </span>
  );
}

/** Puente: resultado del mes anterior → Δingresos → Δcosto de ventas → Δgastos → resultado actual. */
function PuenteVariacion({
  cur,
  prev,
}: {
  cur: OperationalResultResponse;
  prev: OperationalResultResponse;
}) {
  const revC = parseAmount(cur.revenue);
  const revP = parseAmount(prev.revenue);
  const gmC = parseAmount(cur.gross_margin);
  const gmP = parseAmount(prev.gross_margin);
  const resC = parseAmount(cur.result);
  const resP = parseAmount(prev.result);
  const dRev = revC - revP;
  const dCosto = revC - gmC - (revP - gmP); // Δ costo de ventas
  const dGasto = gmC - resC - (gmP - resP); // Δ gastos operacionales
  const paso = (label: string, monto: number, favorable: boolean) => (
    <div className="flex items-center justify-between border-t border-dashed border-border py-1.5 text-sm">
      <span className="text-neutral-mid">{label}</span>
      <span
        className={`font-semibold tabular-nums ${favorable ? "text-success-700" : "text-danger-500"}`}
      >
        {monto >= 0 ? "+" : "−"}
        {formatClp(Math.abs(monto))}
      </span>
    </div>
  );
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between py-1 text-sm">
        <span className="text-neutral-mid">Resultado mes anterior</span>
        <span className="font-semibold tabular-nums text-neutral-dark">{formatClp(resP)}</span>
      </div>
      {paso("Cambio en ingresos", dRev, dRev >= 0)}
      {paso("Cambio en costo de ventas", -dCosto, dCosto <= 0)}
      {paso("Cambio en gastos", -dGasto, dGasto <= 0)}
      <div className="mt-1 flex items-center justify-between border-t-2 border-border-strong py-1.5 text-sm">
        <span className="font-medium text-neutral-dark">Resultado este mes</span>
        <span
          className={`font-bold tabular-nums ${resC >= 0 ? "text-success-700" : "text-danger-500"}`}
        >
          {formatClp(resC)}
        </span>
      </div>
    </div>
  );
}

function Eficiencia({
  cur,
  prev,
  yoy,
}: {
  cur: OperationalResultResponse;
  prev?: OperationalResultResponse;
  yoy?: OperationalResultResponse;
}) {
  const netoPct = (r?: OperationalResultResponse) => {
    if (!r) return null;
    const rev = parseAmount(r.revenue);
    return rev > 0 ? (parseAmount(r.result) / rev) * 100 : null;
  };
  const fila = (label: string, a: number | null, p: number | null, yy: number | null) => (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-dashed border-border py-2 text-sm">
      <span className="text-neutral-mid">{label}</span>
      <span className="flex items-center gap-3">
        <span className="font-bold tabular-nums text-neutral-dark">
          {a === null ? "—" : fmtPct(a)}
        </span>
        <span className="text-[11px] text-neutral-mid">
          mes ant. {p === null ? "—" : fmtPct(p)} · año ant. {yy === null ? "—" : fmtPct(yy)}
        </span>
      </span>
    </div>
  );
  const gm = (r?: OperationalResultResponse) => (r ? parseAmount(r.gross_margin_pct) : null);
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {fila("Margen bruto %", gm(cur), gm(prev), gm(yoy))}
      {fila("Margen neto %", netoPct(cur), netoPct(prev), netoPct(yoy))}
    </div>
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
      <p className="font-bold text-warning-700">No podemos comparar con confianza</p>
      <p className="mt-1 text-neutral-dark">
        El resultado del mes da un margen imposible (≥100%), típicamente un gasto revertido o mal
        clasificado. Está escalado; mirá el detalle en <b>Resultado</b>.
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
