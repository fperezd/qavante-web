"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical, SlidersHorizontal } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";

/* DynamicTable — tabla dinámica reutilizable (propuesta UX).
 *
 * Sobre @tanstack/react-table (ya en deps). Da tres capacidades que el usuario
 * pidió para TODAS las tablas:
 *   1. **Ordenar**: clic en el título → asc / desc / sin orden (con flechas).
 *   2. **Filtrar**: botón "Filtros" → fila de filtros por columna.
 *   3. **Reordenar columnas**: arrastrar el título para moverlo (drag & drop).
 *
 * Alineación por columna vía `meta.align: "right"`. Genérica en TData. */

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Alineación de la celda; "right" para montos. */
    align?: "right";
  }
}

export interface DynamicTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Orden inicial de columnas (ids). Default: el orden de `columns`. */
  initialColumnOrder?: string[];
  /** Orden inicial de filas. */
  initialSorting?: SortingState;
  /** Ancho mínimo de la tabla (para el scroll horizontal). */
  minWidth?: number;
  /** Clic en una fila (ej. abrir detalle). Marca la fila como clickeable. */
  onRowClick?: (row: TData) => void;
  /** Clases extra por fila (ej. resaltar filas en rojo). */
  rowClassName?: (row: TData) => string | undefined;
  /** Estilo visual: `modern` (aireado), `hybrid` (recomendado) o `clear` (tipo Excel). */
  variant?: TableVariant;
}

type TableVariant = "modern" | "hybrid" | "clear";

const VARIANTS: Record<
  TableVariant,
  {
    table: string;
    thead: string;
    headRow: string;
    iconLight: boolean;
    rowBorder: string;
    rowHover: string;
    zebra: string;
  }
> = {
  modern: {
    table: "[&_td]:border-r-0",
    thead: "border-b-2 border-border-strong",
    headRow: "text-neutral-mid",
    iconLight: false,
    rowBorder: "border-border/40",
    rowHover: "hover:bg-surface-muted/50",
    zebra: "",
  },
  hybrid: {
    table: "[&_td]:border-r [&_td]:border-border/25 [&_td:last-child]:border-r-0",
    thead: "border-b border-border-strong bg-surface-muted",
    headRow: "text-neutral-dark",
    iconLight: false,
    rowBorder: "border-border/40",
    rowHover: "hover:bg-surface-muted/70",
    zebra: "even:bg-surface-muted/30",
  },
  clear: {
    table:
      "[&_td]:border-r [&_td]:border-border/40 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-surface/15 [&_th:last-child]:border-r-0",
    thead: "bg-brand-primary",
    headRow: "text-surface/90",
    iconLight: true,
    rowBorder: "border-border/50",
    rowHover: "hover:bg-brand-primary/10",
    zebra: "even:bg-surface-muted/50",
  },
};

function colAlign(meta: unknown): boolean {
  return (meta as { align?: "right" } | undefined)?.align === "right";
}

export function DynamicTable<TData>({
  columns,
  data,
  initialColumnOrder,
  initialSorting,
  minWidth = 720,
  onRowClick,
  rowClassName,
  variant = "hybrid",
}: DynamicTableProps<TData>) {
  const styles = VARIANTS[variant];
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting ?? []);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(
    initialColumnOrder ?? columns.map((c) => c.id as string),
  );
  const [showFilters, setShowFilters] = React.useState(false);
  const dragId = React.useRef<string | null>(null);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnOrder },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function moveColumn(fromId: string, toId: string) {
    if (fromId === toId) return;
    setColumnOrder((prev) => {
      const order = prev.length > 0 ? [...prev] : table.getAllLeafColumns().map((c) => c.id);
      const fromIdx = order.indexOf(fromId);
      const toIdx = order.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, fromId);
      return order;
    });
  }

  const leafCols = table.getAllLeafColumns();
  const anyFilterable = leafCols.some((c) => c.getCanFilter());
  /* Zebra solo cuando las filas no traen su propio color (para no pisar el
     resaltado de quiebre/selección de otras tablas). */
  const zebra = !rowClassName;

  return (
    <div className="space-y-2">
      {anyFilterable && (
        <div className="flex justify-end">
          <QavanteButton
            size="sm"
            variant={showFilters ? "secondary" : "ghost"}
            onClick={() => setShowFilters((v) => !v)}
            aria-pressed={showFilters}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Filtros
          </QavanteButton>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className={cn("w-full text-xs", styles.table)} style={{ minWidth }}>
          <thead className={styles.thead}>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className={cn("text-left text-[11px] font-semibold uppercase tracking-wider", styles.headRow)}
              >
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const align = colAlign(header.column.columnDef.meta);
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragId.current) moveColumn(dragId.current, header.column.id);
                        dragId.current = null;
                      }}
                      className={cn("group/th px-3 py-2.5 align-top", align && "text-right")}
                    >
                      <span className={cn("flex items-center gap-1", align && "flex-row-reverse")}>
                        <span
                          draggable
                          onDragStart={() => {
                            dragId.current = header.column.id;
                          }}
                          className={cn(
                            "cursor-grab opacity-0 transition-opacity group-hover/th:opacity-100 active:cursor-grabbing",
                            styles.iconLight ? "text-surface/50 hover:text-surface" : "text-neutral-mid/50 hover:text-neutral-mid",
                          )}
                          title="Arrastra para mover la columna"
                          aria-hidden="true"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "inline-flex items-center gap-1 font-semibold uppercase tracking-wider",
                              styles.iconLight ? "hover:text-surface" : "hover:text-neutral-dark",
                            )}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === "asc" ? (
                              <ArrowUp className={cn("h-3 w-3", styles.iconLight ? "text-surface" : "text-brand-primary")} aria-hidden="true" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className={cn("h-3 w-3", styles.iconLight ? "text-surface" : "text-brand-primary")} aria-hidden="true" />
                            ) : (
                              <ChevronsUpDown className={cn("h-3 w-3", styles.iconLight ? "text-surface/50" : "text-neutral-mid opacity-0 transition-opacity group-hover/th:opacity-60")} aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </span>
                      {showFilters && header.column.getCanFilter() && (
                        <input
                          value={(header.column.getFilterValue() as string) ?? ""}
                          onChange={(e) => header.column.setFilterValue(e.target.value)}
                          placeholder="Filtrar…"
                          className="mt-1.5 w-full rounded-md border border-border bg-surface px-2 py-1 text-xs font-normal normal-case tracking-normal text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row.original);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                className={cn(
                  "border-b transition-colors last:border-b-0",
                  styles.rowBorder,
                  styles.rowHover,
                  zebra && styles.zebra,
                  onRowClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary",
                  rowClassName?.(row.original),
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = colAlign(cell.column.columnDef.meta);
                  return (
                    <td key={cell.id} className={cn("px-3 py-2 text-neutral-dark", align && "text-right tabular-nums")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={leafCols.length} className="px-3 py-8 text-center text-neutral-mid">
                  Sin resultados para los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-neutral-mid/70">
        Clic en el título para ordenar · arrastra para mover columnas · «Filtros» para filtrar.
      </p>
    </div>
  );
}
