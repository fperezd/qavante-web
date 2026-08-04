import * as React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { prepararDistribucion, type DistribucionItem } from "./concentracion-dimension-model";

/* ConcentracionDimension — panel de distribución de la contraparte por DIMENSIÓN: por TAMAÑO (tramo)
   o por INDUSTRIA (sector). Reusable para las 4 vistas (clientes/proveedores × tamaño/industria).
   Presentacional PURO: recibe los items del backend (#825) ya con monto + pct; recorta al top-N y
   agrupa el resto en "Otros". Marcador de color por categoría + participación % + monto + barra.
   Degrada solo (sin items → vacío honesto). Pendiente de cablear cuando llegue el endpoint. */

/** Paleta categórica (una por categoría, cíclica): consistente con el look de los dashboards que pidió
 *  Fernando. "Otros" usa un gris aparte. */
const PALETA = [
  "bg-brand-primary",
  "bg-info-500",
  "bg-warning-500",
  "bg-success-500",
  "bg-brand-primary/60",
] as const;

export interface ConcentracionDimensionProps {
  /** Título del panel: "Clientes por tamaño" / "Proveedores por industria". */
  titulo: string;
  /** Bajada: "Distribución de los clientes por tamaño de ventas." */
  subtitulo?: string;
  /** Items del período (el componente ordena, recorta a `max` y agrupa "Otros"). */
  items: DistribucionItem[];
  /** Cuántas categorías mostrar antes de agrupar en "Otros" (default 5). */
  max?: number;
  /** Texto cuando no hay datos en el período. */
  emptyLabel?: string;
  className?: string;
}

export function ConcentracionDimension({
  titulo,
  subtitulo,
  items,
  max = 5,
  emptyLabel = "Sin datos en el período.",
  className,
}: ConcentracionDimensionProps) {
  const { top, otros } = prepararDistribucion(items, max);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-sm",
        className,
      )}
      aria-label={titulo}
    >
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-dark">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 text-xs text-neutral-mid">{subtitulo}</p>}
      </div>

      {top.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-neutral-mid">{emptyLabel}</p>
      ) : (
        <ul className="qv-stagger-bars divide-y divide-border">
          {top.map((it, i) => (
            <li key={`${it.label}-${i}`} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn("size-2.5 shrink-0 rounded-sm", PALETA[i % PALETA.length])}
                    aria-hidden="true"
                  />
                  <span
                    className="truncate text-[12.5px] font-semibold text-neutral-dark"
                    title={it.label}
                  >
                    {it.label}
                  </span>
                  {it.hint && (
                    <span
                      className="shrink-0 cursor-help text-neutral-mid"
                      title={it.hint}
                      aria-label={it.hint}
                    >
                      <HelpCircle className="size-3.5" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap text-[12.5px] tabular-nums">
                  <b className="font-bold text-neutral-dark">
                    {/* pct acotado a 0-100 (la base puede netear raro con NC). */}
                    {Math.round(Math.max(0, Math.min(100, it.pct)))}%
                  </b>{" "}
                  <span className="font-semibold text-neutral-mid">{formatClp(it.monto)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={cn("animate-qv-grow-x h-full rounded-full", PALETA[i % PALETA.length])}
                  style={{ width: `${Math.max(2, Math.min(100, it.pct))}%` }}
                />
              </div>
            </li>
          ))}
          {otros && (
            <li className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2 text-neutral-mid">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm bg-neutral-light"
                    aria-hidden="true"
                  />
                  <span className="truncate text-[12.5px] font-medium">Otros</span>
                </span>
                <span className="whitespace-nowrap text-[12.5px] tabular-nums">
                  <b className="font-semibold text-neutral-dark">
                    {Math.round(Math.max(0, Math.min(100, otros.pct)))}%
                  </b>{" "}
                  <span className="font-medium">{formatClp(otros.monto)}</span>
                </span>
              </div>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
