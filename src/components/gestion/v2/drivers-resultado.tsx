import * as React from "react";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";

/* DriversResultado — "Qué explica el resultado" de Gestión v2: los conceptos que más movieron
   el resultado del mes (mejoran / deterioran), ordenados por impacto, con su porqué en lenguaje
   humano. Es el "por esto" que la tabla fría no da. Presentacional; cada driver es clickeable
   → su detalle. Alimentado por `OperationalResultResponse.drivers`. */

export interface DriverItem {
  id: string;
  /** `improves` mejora el resultado; `worsens` lo deteriora. */
  direccion: "improves" | "worsens";
  /** Concepto (ej. "Ventas", "Sueldos"). */
  concepto: string;
  /** Impacto en el resultado (CLP). Se muestra firmado según la dirección. */
  impacto: number;
  /** Explicación corta de por qué. */
  explicacion: string;
  onClick?: () => void;
}

export interface DriversResultadoProps {
  titulo?: string;
  items: DriverItem[];
  className?: string;
}

export function DriversResultado({ titulo = "Qué explica el resultado", items, className }: DriversResultadoProps) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-surface shadow-sm", className)} aria-label={titulo}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-dark">{titulo}</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-neutral-mid">Sin datos para explicar el resultado del período.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => {
            const up = it.direccion === "improves";
            const Icon = up ? TrendingUp : TrendingDown;
            // "+$X" cuando mejora (formatClp no antepone el +); "−$X" cuando deteriora.
            const montoTexto = up ? `+${formatClp(Math.abs(it.impacto))}` : formatClp(-Math.abs(it.impacto));
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={it.onClick}
                  className="group relative grid w-full grid-cols-[30px_1fr_auto] items-start gap-3 px-4 py-3 pr-9 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-[26px] place-items-center rounded-lg",
                      up ? "bg-success-500/10 text-success-700" : "bg-danger-500/10 text-danger-500",
                    )}
                  >
                    <Icon className="size-[15px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-neutral-dark">{it.concepto}</span>
                    <span className="block text-[11.5px] text-neutral-mid">{it.explicacion}</span>
                  </span>
                  <span className={cn("whitespace-nowrap text-right text-[13px] font-extrabold tabular-nums", up ? "text-success-700" : "text-danger-500")}>
                    {montoTexto}
                  </span>
                  <ChevronRight
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-light group-hover:text-brand-primary"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
