import * as React from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";

/* ConcentracionClientes — panel de apoyo del Libro v2: quién concentra la facturación
   (top N por monto), con barra de participación. En el rediseño baja de card grande
   arriba a rail al costado de la tabla. Presentacional: recibe los items YA ordenados
   y con su %. Reusable para Compras (por proveedor). Degrada solo: sin items → vacío
   honesto. */

export interface ConcentracionItem {
  nombre: string;
  rut?: string;
  /** Monto neto acumulado de la contraparte. */
  monto: number;
  /** Participación 0-100 sobre el total del período. */
  pct: number;
}

export interface ConcentracionClientesProps {
  /** Título; cambia por tipo de libro ("por cliente" / "por proveedor"). */
  titulo?: string;
  /** Items ordenados desc por monto (el componente recorta a `max`). */
  items: ConcentracionItem[];
  /** Cuántos mostrar (default 10). */
  max?: number;
  /** Handler del botón "Exportar CSV" (se oculta si no viene). */
  onExport?: () => void;
  /** Texto cuando no hay documentos en el período. */
  emptyLabel?: string;
  className?: string;
}

export function ConcentracionClientes({
  titulo = "Concentración por cliente",
  items,
  max = 10,
  onExport,
  emptyLabel = "Sin documentos en el período.",
  className,
}: ConcentracionClientesProps) {
  const top = items.slice(0, max);
  return (
    <section
      className={cn("overflow-hidden rounded-xl border border-border bg-surface shadow-sm", className)}
      aria-label={titulo}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-dark">{titulo}</h2>
        <div className="flex-1" />
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            aria-label="Exportar CSV"
            title="Exportar CSV"
            className="inline-flex size-7 items-center justify-center rounded-md text-neutral-mid transition-colors hover:bg-surface-muted hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Download className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {top.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-neutral-mid">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border">
          {top.map((it, i) => (
            <li key={`${it.rut ?? it.nombre}-${i}`} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12.5px] font-semibold text-neutral-dark" title={it.nombre}>
                  {it.nombre}
                </span>
                <span className="whitespace-nowrap text-[12.5px] font-bold tabular-nums text-neutral-dark">
                  {formatClp(it.monto)}{" "}
                  {/* pct acotado a 0-100: la base es el neto del período (las NC restan);
                      si el período netea ≤ 0, el % crudo puede dispararse/ser negativo. */}
                  <span className="font-semibold text-neutral-mid">
                    {Math.round(Math.max(0, Math.min(100, it.pct)))}%
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-brand-primary/70"
                  style={{ width: `${Math.max(2, Math.min(100, it.pct))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
