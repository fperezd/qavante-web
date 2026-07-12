import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";

/* ResultadoPreliminar (Inicio Ejecutivo v2). Muestra resultado + margen operacional
   AGREGADO, marcado preliminar cuando faltan clasificar costos, con el rango del
   peor caso (impacto máx. pendiente) — nunca afirma un margen como definitivo si el
   dato está incompleto. Debajo, señales de gestión que SÍ salen del SII (costo que
   más creció, concentración). Sin margen por cliente/producto (no hay costeo).
   Presentacional puro. */

export interface ResultadoExtra {
  label: string;
  valor: string;
  /** "warn" pinta el valor en ámbar (p.ej. un costo que subió). */
  tono?: "warn";
}

export interface ResultadoPreliminarProps {
  resultado: number;
  /** "Resultado operacional · julio". */
  subtitulo: string;
  ingresos: number;
  /** "Margen operacional preliminar" | "Margen operacional". */
  margenLabel: string;
  /** "89%". */
  margen: string;
  /** Advertencia fuerte cuando es preliminar. */
  caveat?: string;
  /** "entre 51% y 89%" — rango según pendientes por clasificar. */
  rango?: string;
  extra: ResultadoExtra[];
  className?: string;
}

export function ResultadoPreliminar({
  resultado,
  subtitulo,
  ingresos,
  margenLabel,
  margen,
  caveat,
  rango,
  extra,
  className,
}: ResultadoPreliminarProps) {
  const pct =
    ingresos > 0 ? Math.min(100, Math.round((Math.abs(resultado) / ingresos) * 100)) : 0;
  /* Una pérdida NO puede leerse como ganancia: color rojo cuando el resultado es
     negativo (el `−$` del formatter no alcanza si el verde dice lo contrario). */
  const negativo = resultado < 0;

  return (
    <section
      className={cn("rounded-xl border border-border bg-surface p-5 shadow-sm", className)}
      aria-label="Resultado del mes"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-mid">
        Resultado del mes
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-extrabold tabular-nums tracking-tight",
          negativo ? "text-danger-500" : "text-success-700",
        )}
      >
        {formatClp(resultado)}
      </p>
      <p className="mt-0.5 mb-3 text-xs text-neutral-mid">{subtitulo}</p>

      <div className="flex flex-col gap-2.5">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-neutral-mid">Ingresos</span>
            <span className="font-extrabold tabular-nums text-neutral-dark">
              {formatClp(ingresos)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-brand-primary" style={{ width: "100%" }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-neutral-mid">Resultado</span>
            <span
              className={cn(
                "font-extrabold tabular-nums",
                negativo ? "text-danger-500" : "text-success-700",
              )}
            >
              {formatClp(resultado)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={cn(
                "h-full rounded-full",
                negativo ? "bg-danger-500" : "bg-success-500",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between py-1 text-[13.5px]">
        <span className="text-neutral-mid">{margenLabel}</span>
        <span className="font-bold tabular-nums text-neutral-dark">{margen}</span>
      </div>
      {caveat && (
        <p className="text-[11px] leading-relaxed text-warning-700">⚠ {caveat}</p>
      )}
      {rango && (
        <div className="flex items-baseline justify-between py-1 text-[13.5px]">
          <span className="text-neutral-mid">Margen potencial (según pendientes)</span>
          <span className="font-bold tabular-nums text-neutral-dark">{rango}</span>
        </div>
      )}
      {extra.map((e, i) => (
        <div key={i} className="flex items-baseline justify-between py-1 text-[13.5px]">
          <span className="text-neutral-mid">{e.label}</span>
          <span
            className={cn(
              "font-semibold",
              e.tono === "warn" ? "text-warning-700" : "text-neutral-dark",
            )}
          >
            {e.valor}
          </span>
        </div>
      ))}
    </section>
  );
}
