import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/* LibroVentasV2 — shell de composición del rediseño del Libro de Ventas (aprobado
   2026-07-13). Ordena la pantalla en la jerarquía del Inicio: la RESPUESTA arriba
   (hero), y JUSTO DEBAJO el detalle — la tabla densa SUBE (queda visible sin
   scrollear), con la concentración como panel de APOYO al costado. Presentacional:
   `hero`, `tabla` y `concentracion` entran como slots (en vivo el hero se cablea a
   los comparativos y la tabla es la GroupedTable real). Sin toggle "Agrupar N/C":
   las anuladas van con su N/C y el detalle se abre al clic (lo maneja la tabla). */

export interface LibroVentasV2Props {
  /** <VentasHero/> — la respuesta de dueño. */
  hero: React.ReactNode;
  /** Filtro de período (dropdown de rango). Opcional. */
  periodFilter?: React.ReactNode;
  /** Sello de frescura "Actualizado hace X · SII". Opcional. */
  stamp?: React.ReactNode;
  /** Total de documentos del período. */
  docCount: number;
  /** Documentos anulados (badge de alerta si > 0). */
  anuladasCount?: number;
  /** Abre el panel de filtros (folio / cliente / tipo). */
  onFiltros?: () => void;
  /** Marca el botón Filtros con un punto si hay filtros aplicados. */
  filtrosActivos?: boolean;
  /** La tabla densa del libro (GroupedTable en vivo). */
  tabla: React.ReactNode;
  /** <ConcentracionClientes/> — panel de apoyo lateral. */
  concentracion: React.ReactNode;
  className?: string;
}

export function LibroVentasV2({
  hero,
  periodFilter,
  stamp,
  docCount,
  anuladasCount = 0,
  onFiltros,
  filtrosActivos,
  tabla,
  concentracion,
  className,
}: LibroVentasV2Props) {
  return (
    <div className={cn("space-y-4", className)}>
      {(periodFilter || stamp) && (
        <div className="flex flex-wrap items-center gap-3">
          {periodFilter}
          <div className="flex-1" />
          {stamp}
        </div>
      )}

      {hero}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        {/* Detalle — la tabla SUBE, justo bajo la respuesta */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-neutral-dark">Documentos</h2>
            <span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-[11.5px] font-bold text-brand-primary">
              {docCount} {docCount === 1 ? "documento" : "documentos"}
            </span>
            {anuladasCount > 0 && (
              <span className="rounded-full bg-danger-500/10 px-2.5 py-0.5 text-[11.5px] font-bold text-danger-500">
                {anuladasCount} {anuladasCount === 1 ? "anulada" : "anuladas"}
              </span>
            )}
            <div className="flex-1" />
            {onFiltros && (
              <button
                type="button"
                onClick={onFiltros}
                className="relative inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-[12.5px] font-semibold text-neutral-dark transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                Filtros
                {filtrosActivos && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-brand-primary" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
          {tabla}
        </div>

        {/* Apoyo — concentración al costado */}
        {concentracion}
      </div>
    </div>
  );
}
