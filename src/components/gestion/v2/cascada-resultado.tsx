import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { computeCascada, type CascadaEntrada } from "./cascada-model";

/* CascadaResultado — la pieza estrella de Gestión v2: el P&L del mes como waterfall de barras
   flotantes. Contesta "de dónde salió y a dónde se fue la plata" de un vistazo: Ingresos →
   −Costos → Margen bruto → −Gasto laboral → −Honorarios → −Gastos → Resultado. Presentacional;
   la aritmética de posición vive en `cascada-model`. Cada línea es clickeable → su detalle. */

export interface CascadaResultadoProps {
  titulo?: string;
  /** Bajada bajo el título (ej. "De dónde salió y a dónde se fue la plata"). */
  subtitulo?: string;
  /** Secuencia del P&L (ver CascadaEntrada). */
  entradas: CascadaEntrada[];
  /** Texto de apoyo a la derecha del título. */
  hint?: string;
  className?: string;
}

export function CascadaResultado({
  titulo = "Resultado operacional",
  subtitulo,
  entradas,
  hint,
  className,
}: CascadaResultadoProps) {
  const barras = computeCascada(entradas);

  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-surface shadow-sm", className)} aria-label={titulo}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-neutral-dark">{titulo}</h2>
          {hint && <span className="ml-auto text-[11.5px] text-neutral-mid">{hint}</span>}
        </div>
        {subtitulo && <p className="mt-0.5 text-[11.5px] text-neutral-mid">{subtitulo}</p>}
      </div>

      <div className="px-3 py-2 sm:px-4">
        {barras.map((b) => {
          const total = b.tipo === "subtotal" || b.tipo === "resultado";
          const grand = b.tipo === "resultado";
          const clickable = typeof b.onClick === "function";
          const opAjuste = b.montoFirmado < 0 ? "−" : "+";
          const op = total ? "=" : b.tipo === "resta" ? "−" : b.tipo === "ajuste" ? opAjuste : " ";
          const montoTono = grand
            ? b.negativo
              ? "text-danger-500"
              : "text-success-700"
            : b.montoFirmado < 0
              ? "text-danger-500"
              : "text-neutral-dark";
          const rowClass = cn(
            "group relative grid w-full grid-cols-[minmax(120px,150px)_1fr_minmax(96px,120px)] items-center gap-3 rounded-lg px-1.5 py-2 text-left",
            clickable && "transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
            total && "bg-brand-primary/[.06]",
            grand && (b.negativo ? "mt-1 bg-danger-500/10" : "mt-1 bg-success-500/10"),
          );
          const content = (
            <>
              <span className={cn("flex items-center gap-1.5 text-[12.5px]", total ? "font-extrabold text-neutral-dark" : "text-neutral-dark")}>
                <span className="w-2.5 shrink-0 font-bold text-neutral-light">{op}</span>
                <span className="truncate">{b.label}</span>
                {b.pct != null && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      grand && !b.negativo
                        ? "bg-success-500/10 text-success-700"
                        : grand && b.negativo
                          ? "bg-danger-500/10 text-danger-500"
                          : "bg-brand-primary/10 text-brand-primary",
                    )}
                  >
                    {formatPct(b.pct)}
                  </span>
                )}
              </span>

              <span className="relative h-[22px]" aria-hidden="true">
                <span
                  className={cn("absolute top-0 h-full rounded", barClass(b.tipo, b.negativo))}
                  style={{ left: `${b.left}%`, width: `${b.width}%` }}
                />
              </span>

              <span className={cn("text-right text-[13px] font-bold tabular-nums", montoTono, grand && "text-[15px]")}>
                {formatClp(b.montoFirmado)}
              </span>

              {clickable && !total && (
                <ChevronRight
                  className="pointer-events-none absolute right-0.5 top-1/2 size-4 -translate-y-1/2 text-neutral-light opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              )}
            </>
          );
          return clickable ? (
            <button key={b.id} type="button" onClick={b.onClick} className={rowClass}>
              {content}
            </button>
          ) : (
            <div key={b.id} className={rowClass}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function barClass(tipo: string, negativo: boolean): string {
  if (tipo === "ingreso") return "bg-brand-primary/80";
  if (tipo === "resta") return "bg-danger-500/45";
  if (tipo === "ajuste") return "bg-neutral-mid/40"; // conciliación "Otros" (neutro)
  if (tipo === "resultado") return negativo ? "bg-danger-500" : "bg-success-600";
  return "bg-brand-primary"; // subtotal
}

/** % con 1 decimal, signo tipográfico (−) para negativos. NO se clampa a [0,100]: un margen
 *  negativo (mes en pérdida) debe verse como tal, no como "0%". */
function formatPct(pct: number): string {
  const r = Math.round(pct * 10) / 10;
  const abs = Math.abs(r).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  return `${r < 0 ? "−" : ""}${abs}%`;
}
