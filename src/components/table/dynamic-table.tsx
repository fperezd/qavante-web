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
  /** Orden inicial de filas (columna + dirección). Default: sin ordenar. */
  initialSorting?: SortingState;
  /** Ancho mínimo de la tabla (para el scroll horizontal). */
  minWidth?: number;
}

function colAlign(meta: unknown): boolean {
  return (meta as { align?: "right" } | undefined)?.align === "right";
}

export function DynamicTable<TData>({
  columns,
  data,
  initialColumnOrder,
  initialSorting,
  minWidth = 720,
}: DynamicTableProps<TData>) {
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
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
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
                      className={cn("px-3 py-2.5 align-top", align && "text-right")}
                    >
                      <span className={cn("flex items-center gap-1", align && "flex-row-reverse")}>
                        <span
                          draggable
                          onDragStart={() => {
                            dragId.current = header.column.id;
                          }}
                          className="cursor-grab text-neutral-mid/40 hover:text-neutral-mid active:cursor-grabbing"
                          title="Arrastra para mover la columna"
                          aria-hidden="true"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-neutral-dark"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-brand-primary" aria-hidden="true" />
                            ) : sorted === "desc" ? (
                              <ArrowDown
                                className="h-3 w-3 text-brand-primary"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 opacity-30" aria-hidden="true" />
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
                className="border-b border-border/60 last:border-b-0 hover:bg-surface-muted"
              >
                {row.getVisibleCells().map((cell) => {
                  const align = colAlign(cell.column.columnDef.meta);
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-3 py-2 text-neutral-dark",
                        align && "text-right tabular-nums",
                      )}
                    >
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

      <p className="text-xs text-neutral-mid">
        Clic en un título para ordenar · arrastra el ⠿ para mover columnas · botón «Filtros» para
        filtrar por columna.
      </p>
    </div>
  );
}
