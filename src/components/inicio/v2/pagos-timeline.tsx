import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { CardLink } from "./card-link";

/* Pagos críticos — vencidos y próximos (Inicio Ejecutivo v2). Muestra SIEMPRE los
   vencimientos del período con su fecha (pedido de Fernando) y clasifica cada uno
   por postergabilidad: lo que "reprogramar pagos" puede tocar es solo lo negociable/
   postergable, nunca el total. Presentacional puro. */

export type Postergabilidad =
  | "no_postergable"
  | "negociable"
  | "postergable"
  | "cubierto"
  | "sin_cobertura";

const TAG_LABEL: Record<Postergabilidad, string> = {
  no_postergable: "No postergable",
  negociable: "Negociable",
  postergable: "Postergable",
  cubierto: "Cubierto",
  sin_cobertura: "Sin cobertura",
};

const TAG_CLASS: Record<Postergabilidad, string> = {
  no_postergable: "bg-danger-50 text-danger-500",
  negociable: "bg-warning-50 text-warning-700",
  postergable: "bg-surface-muted text-neutral-mid",
  cubierto: "bg-success-50 text-success-700",
  sin_cobertura: "bg-danger-50 text-danger-500",
};

function tagValue<T>(rec: Record<Postergabilidad, T>, k: Postergabilidad): T {
  return (rec as Record<string, T>)[k] ?? rec.postergable;
}

export interface PagoCritico {
  /** Etiqueta de fecha legible: "Venció 30-06", "Vence día 20", "Próx. 14 días". */
  fecha: string;
  nombre: string;
  monto: number;
  tipo: Postergabilidad;
  /** Vencido = punto rojo en el riel + fecha en rojo. */
  vencido?: boolean;
}

export interface PagosTimelineProps {
  total: number;
  /** "Vencidos o exigibles durante los próximos 14 días". */
  subtitulo: string;
  pagos: PagoCritico[];
  /** El total en rojo cuando la caja no lo cubre (crisis). */
  totalEnRojo?: boolean;
  /** Salida al detalle (regla "todo dato lleva a su detalle"). Sin href → sin link. */
  href?: string;
  cta?: string;
  className?: string;
}

export function PagosTimeline({
  total,
  subtitulo,
  pagos,
  totalEnRojo,
  href,
  cta,
  className,
}: PagosTimelineProps) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-surface p-5 shadow-sm", className)}
      aria-label="Pagos críticos vencidos y próximos"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-mid">
        Pagos críticos vencidos y próximos
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-extrabold tabular-nums tracking-tight",
          totalEnRojo ? "text-danger-500" : "text-neutral-dark",
        )}
      >
        {formatClp(total)}
      </p>
      <p className="mt-0.5 text-xs text-neutral-mid">{subtitulo}</p>

      <ol className="relative mt-4 pl-[18px]">
        {/* Riel vertical del timeline — gradiente sutil (más presente arriba, se desvanece abajo). */}
        <span
          className="absolute left-[5px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-gradient-to-b from-brand-primary/30 to-border"
          aria-hidden="true"
        />
        {pagos.map((p, i) => (
          <li key={i} className="relative py-2">
            <span
              className={cn(
                "absolute left-[-16px] top-3 h-2.5 w-2.5 rounded-full border-2 bg-surface",
                p.vencido
                  ? "border-danger-500 bg-danger-500 shadow-[0_0_6px] shadow-danger-500/50"
                  : "border-neutral-mid",
              )}
              aria-hidden="true"
            />
            <p
              className={cn(
                "text-[11px] font-bold uppercase tracking-wide",
                p.vencido ? "text-danger-500" : "text-neutral-mid",
              )}
            >
              {p.fecha}
            </p>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="min-w-0 text-sm text-neutral-dark">
                {p.nombre}{" "}
                <span
                  className={cn(
                    "ml-0.5 inline-block rounded px-1.5 py-px text-[10px] font-bold align-middle",
                    tagValue(TAG_CLASS, p.tipo),
                  )}
                >
                  {tagValue(TAG_LABEL, p.tipo)}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap text-sm font-extrabold tabular-nums",
                  p.vencido ? "text-danger-500" : "text-neutral-dark",
                )}
              >
                {formatClp(p.monto)}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <CardLink href={href} cta={cta ?? "Ver pagos"} contexto="Pagos críticos" />
    </section>
  );
}
