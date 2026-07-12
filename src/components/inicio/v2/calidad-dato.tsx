import * as React from "react";
import { cn } from "@/lib/utils";

/* CalidadDato (Inicio Ejecutivo v2). "Clasificar movimientos" sale del top de
   acciones (no mueve caja por sí solo) y baja a este bloque de calidad, pero
   CUANTIFICADO: cuánto puede cambiar la caja/resultado. Sube a prioridad solo si el
   impacto lo justifica. Presentacional puro. */

export interface CalidadDatoProps {
  /** "Hay 195 movimientos sin clasificar por hasta $3,4M — pueden cambiar la caja…". */
  texto: React.ReactNode;
  ctaLabel: string;
  className?: string;
}

export function CalidadDato({ texto, ctaLabel, className }: CalidadDatoProps) {
  return (
    <section
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-3.5 shadow-sm",
        className,
      )}
      aria-label="Calidad de la información"
    >
      <span aria-hidden="true" className="text-lg">
        🧹
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-mid">
          Calidad de la información
        </p>
        <p className="mt-0.5 text-[13px] text-neutral-dark">{texto}</p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-semibold text-brand-primary"
      >
        {ctaLabel}
      </button>
    </section>
  );
}
