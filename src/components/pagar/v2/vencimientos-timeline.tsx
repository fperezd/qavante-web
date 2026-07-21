import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";

/* VencimientosTimeline — "Por vencer y vencidos" de Pagar v2: los pagos ordenados por
   urgencia (vencido → por fecha), cada uno con su POSTERGABILIDAD (no postergable /
   negociable / cubierto) — el insight que hoy Pagar no tiene. Presentacional; cada fila
   es clickeable → su detalle (folio, contraparte, cuotas). Reemplaza el acordeón por
   categoría por un riel por fecha. */

export type Postergabilidad = "no_postergable" | "negociable" | "cubierto";

export interface Vencimiento {
  id: string;
  /** true si ya venció (se resalta en rojo). */
  vencido?: boolean;
  /** Fecha corta (ej. "13-07"). */
  fecha: string;
  /** Nombre del acreedor/obligación. */
  acreedor: string;
  /** Sub-línea (ej. "Proveedor · factura 8842"). */
  detalle?: string;
  /** Monto en CLP (para ordenar/sumar). */
  monto: number;
  /** Monto en moneda de origen si es extranjera (ej. "US$1.240"). */
  montoOrigen?: string;
  postergabilidad?: Postergabilidad;
  /** Monto estimado (ej. F29 antes de que el SII lo emita) → badge "Estimación". */
  estimado?: boolean;
  onClick?: () => void;
}

export interface VencimientosTimelineProps {
  items: Vencimiento[];
  className?: string;
}

const TAG: Record<Postergabilidad, { label: string; cls: string }> = {
  no_postergable: { label: "No postergable", cls: "bg-danger-500/10 text-danger-500" },
  negociable: { label: "Negociable", cls: "bg-warning-500/10 text-warning-700" },
  cubierto: { label: "Cubierto", cls: "bg-success-500/10 text-success-700" },
};

export function VencimientosTimeline({ items, className }: VencimientosTimelineProps) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {items.map((it) => {
        const tag = it.postergabilidad ? TAG[it.postergabilidad] : null;
        // Solo es un botón (con foco + chevron) si tiene destino; si no, un contenedor plano
        // (sin afordance no-op, sin foco vacío). El drill-down lo cablea el container en vivo.
        const clickable = typeof it.onClick === "function";
        const rowClass = cn(
          "group relative grid w-full grid-cols-[76px_1fr_auto] items-center gap-3 py-2.5 pl-4 text-left",
          clickable
            ? "pr-8 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            : "pr-4",
        );
        const content = (
          <>
            {/* fecha + punto del riel */}
            <span
              className={cn(
                "relative border-r-2 border-border pr-3 text-right text-[12px] font-bold",
                it.vencido ? "text-danger-500" : "text-neutral-dark",
              )}
            >
              {it.vencido ? "Venció" : "Vence"}
              <span className="block text-[10.5px] font-semibold text-neutral-light">
                {it.fecha}
              </span>
              <span
                className={cn(
                  "absolute -right-[5px] top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-surface",
                  it.vencido
                    ? "bg-danger-500 shadow-[0_0_6px] shadow-danger-500/50"
                    : "bg-brand-primary shadow-[0_0_5px] shadow-brand-primary/40",
                )}
                aria-hidden="true"
              />
            </span>

            {/* acreedor + detalle + tag */}
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] font-semibold text-neutral-dark">
                {it.acreedor}
                {tag && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", tag.cls)}>
                    {tag.label}
                  </span>
                )}
                {it.estimado && (
                  <span className="rounded-full bg-warning-500/10 px-2 py-0.5 text-[10.5px] font-bold text-warning-700">
                    Estimación
                  </span>
                )}
              </span>
              {it.detalle && (
                <span className="block truncate text-[11.5px] text-neutral-light">
                  {it.detalle}
                </span>
              )}
            </span>

            {/* monto */}
            <span className="whitespace-nowrap text-right">
              <span className="block text-[14px] font-bold tabular-nums text-neutral-dark">
                {formatClp(it.monto)}
              </span>
              {it.montoOrigen && (
                <span className="block text-[11px] text-neutral-light">{it.montoOrigen}</span>
              )}
            </span>

            {clickable && (
              <ChevronRight
                className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-light group-hover:text-brand-primary"
                aria-hidden="true"
              />
            )}
          </>
        );
        return (
          <li key={it.id}>
            {clickable ? (
              <button type="button" onClick={it.onClick} className={rowClass}>
                {content}
              </button>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
