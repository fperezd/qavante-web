import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AmountCountUp } from "@/components/qavante/amount-count-up";
import { InfoHint } from "@/components/ui/info-hint";
import { Sparkline } from "@/components/ui/sparkline";

/* VentasHero — la "respuesta de dueño" del Libro de Ventas v2 (rediseño aprobado
   2026-07-13). Presentacional: recibe el neto del período + comparativos YA
   calculados + la serie mensual. En 3ª persona, número de oro dominante, y hasta
   tres lecturas honestas del ritmo (mes / año / año-contra-año). Degrada solo:
   cada comparativo o la serie que no venga, se OMITE (no se inventa). Reusable
   para el Libro de Compras cambiando `titulo`/`subtitulo`/labels. */

/** Una comparación del ritmo de ventas. `pct` positivo = subió (verde ↗), negativo
 *  = bajó (rojo ↘). `label` explica CONTRA QUÉ se compara (en lenguaje de dueño). */
export interface HeroComparativo {
  pct: number;
  label: string;
}

/** Cifra secundaria (IVA débito, documentos, notas de crédito, anuladas). */
export interface HeroSecundario {
  label: string;
  valor: string;
  tono?: "brand" | "neg" | "default";
}

export interface VentasHeroProps {
  /** Antetítulo, ej. "La empresa vendió". */
  titulo: string;
  /** Neto del período (con notas de crédito ya descontadas). */
  montoNeto: number;
  /** Pie del número de oro, ej. "Neto del período · 58 facturas emitidas". */
  subtitulo: string;
  /** Texto del ⓘ que explica la cifra (opcional). */
  infoHint?: React.ReactNode;
  /** Hasta 3 comparativos; los ausentes se omiten (degradado honesto). */
  comparativos?: HeroComparativo[];
  /** Serie de ventas netas por mes (más reciente último) para el sparkline. */
  serie?: number[];
  /** Caption de la tendencia, ej. "pico jul $23,4M". */
  serieCaption?: React.ReactNode;
  /** Etiquetas de meses bajo el sparkline (ej. ["feb",…,"jul"]). */
  serieMeses?: string[];
  /** Cifras secundarias (se muestran las que haya). */
  secundarios: HeroSecundario[];
  className?: string;
}

/** "+8%" / "−8%" con el menos tipográfico (U+2212), como el resto de las cifras. */
function formatPct(pct: number): string {
  const rounded = Math.round(pct);
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded)}%`;
}

function Comparativo({ pct, label }: HeroComparativo) {
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="flex items-center gap-1.5 text-[12.5px]">
      <Icon
        className={cn("size-3.5 shrink-0", up ? "text-success-700" : "text-danger-500")}
        aria-hidden="true"
      />
      <span className={cn("font-extrabold tabular-nums", up ? "text-success-700" : "text-danger-500")}>
        {formatPct(pct)}
      </span>
      <span className="font-medium text-neutral-mid">{label}</span>
    </span>
  );
}

export function VentasHero({
  titulo,
  montoNeto,
  subtitulo,
  infoHint,
  comparativos,
  serie,
  serieCaption,
  serieMeses,
  secundarios,
  className,
}: VentasHeroProps) {
  const comps = (comparativos ?? []).slice(0, 3);
  const hasSerie = Boolean(serie && serie.length >= 2);

  return (
    <div
      className={cn(
        "grid items-stretch gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm",
        // Sin sparkline (ej. un solo mes → sin tendencia) la grilla es de 2 columnas:
        // así no queda una 3ª columna vacía mostrando el fondo gris.
        "sm:grid-cols-2",
        hasSerie ? "lg:grid-cols-[1.15fr_0.95fr_1fr]" : "lg:grid-cols-2",
        className,
      )}
    >
      {/* Columna 1 — la respuesta de dueño */}
      <div className="bg-surface p-5">
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">{titulo}</p>
        <p className="mt-1.5 text-[33px] font-extrabold leading-none tracking-tight text-neutral-dark tabular-nums">
          <AmountCountUp value={montoNeto} />
        </p>
        {comps.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {comps.map((c, i) => (
              <Comparativo key={i} {...c} />
            ))}
          </div>
        )}
        <p className="mt-2.5 text-[12.5px] text-neutral-mid">
          {subtitulo}
          {infoHint ? (
            <>
              {" "}
              <InfoHint label="Qué significa esta cifra">{infoHint}</InfoHint>
            </>
          ) : null}
        </p>
      </div>

      {/* Columna 2 — tendencia mes a mes (se omite si no hay serie) */}
      {hasSerie && (
        <div className="bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
              Mes a mes
            </span>
            {serieCaption ? (
              <span className="text-[12px] text-neutral-mid">{serieCaption}</span>
            ) : null}
          </div>
          <Sparkline data={serie as number[]} tone="brand" width={300} height={62} className="mt-2.5 w-full" />
          {serieMeses && serieMeses.length > 0 && (
            <div className="mt-0.5 flex justify-between text-[10.5px] text-neutral-light">
              {serieMeses.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Columna 3 — cifras secundarias */}
      <div className="bg-surface p-5">
        <dl className="flex flex-col">
          {secundarios.map((s, i) => (
            <div
              key={i}
              className={cn(
                "flex items-baseline justify-between gap-3 py-1.5",
                i > 0 && "border-t border-dashed border-border",
              )}
            >
              <dt className="text-[12.5px] text-neutral-mid">{s.label}</dt>
              <dd
                className={cn(
                  "text-[15px] font-bold tabular-nums",
                  s.tono === "brand" && "text-brand-primary",
                  s.tono === "neg" && "text-danger-500",
                  (!s.tono || s.tono === "default") && "text-neutral-dark",
                )}
              >
                {s.valor}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
