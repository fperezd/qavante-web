"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import type { OperationalResultBreakdown } from "@/lib/api/gestion";
import { formatClp } from "@/lib/formatters/clp";
import { ResultadoHero, type ResultadoTono } from "./resultado-hero";
import { TendenciaResultado } from "./tendencia-resultado";
import { OperationalResultMatrix } from "../operational-result-matrix";
import {
  mapRangoResumen,
  rangoConfiable,
  warningLabel,
  type RangoResumen,
} from "./gestion-v2-rango-map";

/* Vista de RANGO de Gestión v2 (varios meses). Misma familia visual que el modo un-mes, pero la
   pieza central es la COMPARACIÓN en el tiempo (no la cascada de un mes): respuesta de dueño del
   período + márgenes bruto/neto ($ y %) + "Margen operacional en el tiempo" como protagonista +
   la matriz P&L mes a mes (Chipax) que ya existe. Presentacional: recibe el breakdown resuelto.
   Container: NO se testea por play (ADR-0018); la lógica vive en `gestion-v2-rango-map`. */

const AÑO_RE = /(\d{4})-\d{2}$/;

export function GestionV2RangoView({ data }: { data: OperationalResultBreakdown }) {
  // Mismo guard que el mes: si el cálculo llega implausible (resultado > ingresos), no mostramos
  // números confiados — degradamos honesto y dejamos la matriz cruda para inspección.
  if (!rangoConfiable(data)) return <RangoIncompleto data={data} />;

  const r = mapRangoResumen(data);
  const gano = r.neto.monto >= 0;
  const { texto, tono } = fraseRango(r.tendencia);
  const anioTo = (data.period_to ?? "").match(AÑO_RE)?.[1] ?? "";

  return (
    <div className="space-y-4">
      <ResultadoWarnings warnings={data.warnings} />

      {/* Baranda: respuesta de dueño del período (resultado + márgenes + ritmo) */}
      <div className="grid items-stretch gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-2 lg:grid-cols-[1.15fr_1fr_1fr]">
        <div className="bg-surface">
          <ResultadoHero
            titulo={gano ? "El negocio ganó en el período" : "El negocio perdió en el período"}
            resultado={r.neto.monto}
            respuesta={texto}
            respuestaTono={tono}
            subtitulo={`Resultado operacional acumulado · ${r.rangoLabel} ${anioTo}`.trim()}
            infoHint="Suma del resultado operacional de los meses del rango. Es devengado, no es caja."
          />
        </div>
        <div className="bg-surface">
          <Margenes resumen={r} />
        </div>
        <div className="bg-surface">
          <Ritmo resumen={r} />
        </div>
      </div>

      {/* Pieza central: el margen operacional en el tiempo */}
      {r.tendencia.length >= 2 && (
        <TendenciaResultado titulo="Margen operacional en el tiempo" puntos={r.tendencia} />
      )}

      {/* La matriz P&L mes a mes (Chipax), la herramienta correcta para comparar el rango */}
      <OperationalResultMatrix data={data} />
    </div>
  );
}

/** Frase del hero según cómo viene el margen en el rango. */
function fraseRango(tendencia: RangoResumen["tendencia"]): { texto: string; tono: ResultadoTono } {
  if (tendencia.length < 2) return { texto: "Resultado acumulado del período.", tono: "ok" };
  const first = tendencia[0]!.margenPct;
  const last = tendencia[tendencia.length - 1]!.margenPct;
  if (last > first)
    return { texto: `El margen viene subiendo (${fmtPct(first)} → ${fmtPct(last)}).`, tono: "ok" };
  if (last < first)
    return { texto: `El margen viene bajando (${fmtPct(first)} → ${fmtPct(last)}).`, tono: "bad" };
  return { texto: "El margen se mantiene estable en el período.", tono: "warn" };
}

function Margenes({ resumen }: { resumen: RangoResumen }) {
  const row = (k: string, monto: number, pct: number, dashed = true) => (
    <div
      className={`flex items-baseline justify-between gap-3 py-1.5 ${dashed ? "border-t border-dashed border-border" : ""}`}
    >
      <dt className="text-neutral-mid">{k}</dt>
      <dd className="font-bold tabular-nums text-neutral-dark">
        {formatClp(monto)} · <span className="text-neutral-mid">{fmtPct(pct)}</span>
      </dd>
    </div>
  );
  return (
    <div className="p-5">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
        Márgenes del período
      </p>
      <dl className="mt-2 flex flex-col text-[12.5px]">
        {row("Margen bruto", resumen.bruto.monto, resumen.bruto.pct, false)}
        {row("Margen neto", resumen.neto.monto, resumen.neto.pct)}
      </dl>
      {resumen.mejorMes && (
        <p className="mt-2.5 text-[12px] text-neutral-mid">
          Mejor mes:{" "}
          <b className="text-neutral-dark">
            {resumen.mejorMes.periodo} · {fmtPct(resumen.mejorMes.pct)}
          </b>
        </p>
      )}
    </div>
  );
}

function Ritmo({ resumen }: { resumen: RangoResumen }) {
  const { tendencia } = resumen;
  const sube =
    tendencia.length >= 2 && tendencia[tendencia.length - 1]!.margenPct > tendencia[0]!.margenPct;
  const baja =
    tendencia.length >= 2 && tendencia[tendencia.length - 1]!.margenPct < tendencia[0]!.margenPct;
  return (
    <div className="p-5">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
        Cómo viene el ritmo
      </p>
      <dl className="mt-2.5 flex flex-col gap-2.5 text-[12.5px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-neutral-mid">Ingresos del período</dt>
          <dd className="font-bold tabular-nums text-neutral-dark">
            {formatClp(resumen.ingresos)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-neutral-mid">Tendencia del margen</dt>
          <dd
            className={`font-bold ${sube ? "text-success-700" : baja ? "text-danger-500" : "text-neutral-mid"}`}
          >
            {sube ? "↑ sube" : baja ? "↓ baja" : "→ estable"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Rango con datos implausibles (mismo bug de costos que el mes): honesto, sin números confiados. */
function RangoIncompleto({ data }: { data: OperationalResultBreakdown }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-warning-500/40 bg-warning-500/[.06] p-5">
        <p className="inline-flex items-center gap-2 text-[13px] font-bold text-warning-700">
          <AlertTriangle className="size-[18px] shrink-0" aria-hidden="true" />
          No podemos mostrar el resultado del período con confianza
        </p>
        <p className="mt-2 text-[13px] text-neutral-dark">
          El cálculo llega inconsistente (el resultado supera a los ingresos o faltan costos). Es un
          problema de datos del backend, ya escalado, abajo dejamos la matriz cruda para
          inspección, sin márgenes inventados.
        </p>
      </section>
      <ResultadoWarnings warnings={data.warnings} />
      <OperationalResultMatrix data={data} />
    </div>
  );
}

/** Avisos del backend sobre el cálculo del resultado (`breakdown.warnings`, CC-API #691) — ej. ingresos
 *  sin costo de venta → margen inflado. Traducidos a lenguaje de dueño; sin avisos, no rendea nada. */
function ResultadoWarnings({ warnings }: { warnings?: string[] | null }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div
      role="note"
      className="rounded-xl border border-warning-500/30 bg-warning-500/[.07] p-3 text-[13px] text-neutral-dark"
    >
      <p className="inline-flex items-center gap-1.5 font-semibold text-warning-700">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        {warnings.length === 1
          ? "Un aviso sobre este resultado"
          : `${warnings.length} avisos sobre este resultado`}
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {warnings.map((w, i) => (
          <li key={i}>{warningLabel(w)}</li>
        ))}
      </ul>
    </div>
  );
}

function fmtPct(v: number): string {
  const abs = Math.abs(v).toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${v < 0 ? "−" : ""}${abs}%`;
}
