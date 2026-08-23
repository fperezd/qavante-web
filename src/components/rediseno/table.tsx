"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* Tabla estándar — ESPECIFICACION.md §1.3 "Tabla estándar" (`.tw > table.t`).
 *
 * Contrato distinto de `DynamicTable` (src/components/table/), a propósito:
 * - Header mono uppercase, **sticky**.
 * - Columna principal (`meta.principal`) NUNCA trunca — el resto sí, con tooltip.
 * - **Sin scroll horizontal de página** (Ley 7 / criterio de aceptación #2): en
 *   vez de `overflow-x-auto`, las columnas de metadato (`meta.hideBelow`) se
 *   colapsan en viewport angosto. La columna principal y los montos nunca se
 *   ocultan.
 * - Footer con conteo total + Exportar + paginación `‹ 1 · 2 · 3 … N ›`.
 * - Orden por click en el header (sin drag&drop de columnas — eso es una
 *   feature de `DynamicTable`, no del spec del rediseño). */

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Alineación derecha + tabular-nums — para montos. */
    align?: "right";
    /** La columna principal: nunca trunca, nunca se oculta. Solo una por tabla. */
    principal?: boolean;
    /** Metadato: se oculta en viewport angosto en vez de forzar scroll horizontal. */
    hideBelow?: "sm" | "md";
  }
}

function colMeta(def: unknown) {
  return (
    (def as { align?: "right"; principal?: boolean; hideBelow?: "sm" | "md" } | undefined) ?? {}
  );
}

export interface TablePrimaryCellProps {
  value: React.ReactNode;
  sub?: React.ReactNode;
}

/** Celda de columna principal: `value` nunca trunca; `sub` sí, con tooltip. */
export function TablePrimaryCell({ value, sub }: TablePrimaryCellProps) {
  return (
    <div>
      <div className="font-semibold text-rediseno-tinta">{value}</div>
      {sub && (
        <div
          className="mt-0.5 truncate text-[11.5px] text-rediseno-tinta-3-light"
          title={typeof sub === "string" ? sub : undefined}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export interface RedisenoTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Total real (puede diferir de `data.length` si el fetch está paginado server-side). */
  totalCount?: number;
  pageSize?: number;
  onExport?: () => void;
  emptyMessage?: string;
}

export function RedisenoTable<TData>({
  columns,
  data,
  totalCount,
  pageSize = 50,
  onExport,
  emptyMessage = "Sin resultados.",
}: RedisenoTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const leafCols = table.getAllLeafColumns();
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const total = totalCount ?? data.length;

  return (
    <div className="overflow-hidden rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie">
      <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-[13.5px]">
          <thead className="sticky top-0 z-10 bg-[#FAFBFD]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-rediseno-hairline">
                {hg.headers.map((header) => {
                  const meta = colMeta(header.column.columnDef.meta);
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        "whitespace-nowrap px-[18px] py-[11px] text-left font-rediseno-mono text-[10px] font-semibold tracking-[.1em] text-rediseno-tinta-3-light uppercase",
                        meta.align === "right" && "text-right",
                        meta.hideBelow === "sm" && "hidden sm:table-cell",
                        meta.hideBelow === "md" && "hidden md:table-cell",
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 uppercase tracking-[.1em] hover:text-rediseno-tinta-2"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3 text-rediseno-azul" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3 text-rediseno-azul" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-30" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-rediseno-hairline-row-2 last:border-b-0">
                {row.getVisibleCells().map((cell) => {
                  const meta = colMeta(cell.column.columnDef.meta);
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-[18px] py-3 align-baseline text-rediseno-tinta-2",
                        meta.align === "right" &&
                          "text-right font-semibold text-rediseno-tinta tabular-nums whitespace-nowrap",
                        meta.hideBelow === "sm" && "hidden sm:table-cell",
                        meta.hideBelow === "md" && "hidden md:table-cell",
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
                <td
                  colSpan={leafCols.length}
                  className="px-[18px] py-10 text-center text-rediseno-tinta-3-light"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-rediseno-hairline-row px-[18px] py-[11px] text-[12.5px] text-rediseno-tinta-3-light">
        <span>{total.toLocaleString("es-CL")} registros</span>
        {onExport && (
          <button type="button" onClick={onExport} className="font-bold text-rediseno-azul">
            Exportar
          </button>
        )}
        {pageCount > 1 && (
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Página anterior"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              className="text-rediseno-azul disabled:opacity-30"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            {Array.from({ length: pageCount }, (_, i) => i)
              .filter((i) => i === 0 || i === pageCount - 1 || Math.abs(i - pageIndex) <= 1)
              .reduce<number[]>((acc, i) => {
                const last = acc.at(-1);
                if (last !== undefined && i - last > 1) acc.push(-1);
                acc.push(i);
                return acc;
              }, [])
              .map((i, idx) =>
                i === -1 ? (
                  <span key={`gap-${idx}`}>…</span>
                ) : (
                  <button
                    key={i}
                    type="button"
                    aria-current={i === pageIndex ? "page" : undefined}
                    onClick={() => table.setPageIndex(i)}
                    className={cn(
                      "font-semibold",
                      i === pageIndex ? "text-rediseno-tinta" : "text-rediseno-tinta-3-light",
                    )}
                  >
                    {i + 1}
                  </button>
                ),
              )}
            <button
              type="button"
              aria-label="Página siguiente"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              className="text-rediseno-azul disabled:opacity-30"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
