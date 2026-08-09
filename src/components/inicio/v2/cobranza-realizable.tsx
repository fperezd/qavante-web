import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { CardLink } from "./card-link";

/* CobranzaRealizable (Inicio Ejecutivo v2). Lidera con lo que ENTRA a tiempo
   (estimado por comportamiento de pago, no el total por cobrar) y lo segmenta por
   probabilidad. El total de $205M queda como dato secundario. Presentacional puro;
   los segmentos vienen del motor DSO/DPO (collection-forecast, pedido a CC-API). */

export type BandaCobro = "high" | "probable" | "unknown";

const BANDA_DOT: Record<BandaCobro, string> = {
  high: "bg-success-500",
  probable: "bg-warning-500",
  unknown: "bg-neutral-mid",
};

function bandaValue<T>(rec: Record<BandaCobro, T>, k: BandaCobro): T {
  return (rec as Record<string, T>)[k] ?? rec.unknown;
}

export interface CobranzaSegmento {
  label: string;
  monto: number;
  banda: BandaCobro;
}

export interface CobranzaRealizableProps {
  /** Lo que se espera cobrar a tiempo dentro del horizonte. */
  esperadoATiempo: number;
  /** "Cobranza esperada a tiempo · próximos 14 días". */
  subtitulo: string;
  segmentos: CobranzaSegmento[];
  totalPorCobrar: number;
  /** Monto vencido (0 = al día → verde). `null` = SIN DATO (el SII no da vencimientos): NO se
   *  pinta "$0" (mentiría "al día"), se muestra "sin dato de vencido". */
  vencido: number | null;
  /** Aviso honesto de POR QUÉ está degradada (ej. falló el forecast). Sin nota → no se muestra. */
  nota?: React.ReactNode;
  /** Salida al detalle (regla "todo dato lleva a su detalle"). Sin href → sin link. */
  href?: string;
  cta?: string;
  className?: string;
}

export function CobranzaRealizable({
  esperadoATiempo,
  subtitulo,
  segmentos,
  totalPorCobrar,
  vencido,
  nota,
  href,
  cta,
  className,
}: CobranzaRealizableProps) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-surface p-5 shadow-sm", className)}
      aria-label="Cobranza esperada"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-mid">Cobranza</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-neutral-dark">
        {formatClp(esperadoATiempo)}
      </p>
      <p className="mt-0.5 text-xs text-neutral-mid">{subtitulo}</p>

      <ul className="mt-3">
        {segmentos.map((s, i) => (
          <li
            key={i}
            className="flex items-center gap-2.5 border-t border-border py-2 text-sm first:border-t-0"
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", bandaValue(BANDA_DOT, s.banda))} />
            <span className="min-w-0 flex-1 text-neutral-dark">{s.label}</span>
            <span className="shrink-0 font-extrabold tabular-nums text-neutral-dark">
              {formatClp(s.monto)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 text-[11px] leading-relaxed text-neutral-mid">
        Total por cobrar {formatClp(totalPorCobrar)} ·{" "}
        {vencido == null ? (
          <span>sin dato de vencido: el SII aún no entrega los vencimientos</span>
        ) : (
          <span className={cn(Math.round(vencido) === 0 && "font-semibold text-success-700")}>
            {Math.round(vencido) === 0 ? "$0 vencido" : `${formatClp(vencido)} vencido`}
          </span>
        )}
      </p>

      {nota && (
        <p className="mt-2 rounded-md border border-warning-500/30 bg-warning-500/[.07] px-2.5 py-1.5 text-[11px] text-neutral-dark">
          {nota}
        </p>
      )}

      <CardLink href={href} cta={cta ?? "Ver cobranza"} contexto="Cobranza" />
    </section>
  );
}
