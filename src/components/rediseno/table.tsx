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
    /** Igual que `hideBelow`, pero medido contra el ancho de la TABLA (container query) en vez
     *  del viewport. Opt-in: quien no lo declara conserva el comportamiento por viewport tal
     *  cual. Sirve para tablas que tienen que caber en un contenedor angosto aunque la ventana
     *  sea ancha, y hace que el caso se pueda FIJAR en una story sin cambiarle el viewport al
     *  navegador. Lo usa V04 · Cobrar. */
    hideBelowTable?: "sm" | "md";
  }
}

/** Colapso por ancho del CONTENEDOR (`hideBelowTable`). Requiere `@container` en el wrapper, que
 *  sólo se activa cuando alguna columna lo declara: así una tabla que no lo usa queda byte por byte
 *  como estaba. Los umbrales son los mismos números que `sm`/`md`, pero contra otra caja. */
const OCULTAR_SI_TABLA_ANGOSTA: Record<"sm" | "md", string> = {
  sm: "@max-[640px]:hidden",
  md: "@max-[768px]:hidden",
};

interface MetaColumna {
  align?: "right";
  principal?: boolean;
  hideBelow?: "sm" | "md";
  hideBelowTable?: "sm" | "md";
}

function colMeta(def: unknown): MetaColumna {
  return (def as MetaColumna | undefined) ?? {};
}

/** Las clases de colapso de una columna: por viewport, por contenedor, o ninguna. */
function clasesColapso(meta: MetaColumna): string[] {
  return [
    meta.hideBelow === "sm" ? "hidden sm:table-cell" : "",
    meta.hideBelow === "md" ? "hidden md:table-cell" : "",
    meta.hideBelowTable ? OCULTAR_SI_TABLA_ANGOSTA[meta.hideBelowTable] : "",
  ].filter(Boolean);
}

export interface TablePrimaryCellProps {
  value: React.ReactNode;
  sub?: React.ReactNode;
}

/** Celda de columna principal: ni `value` ni `sub` se truncan (Ley 7).
 *
 * El metadato se puede envolver y partir en una palabra excepcionalmente larga. Es importante que
 * sea el comportamiento compartido: `truncate` agrega `white-space: nowrap`, que en una tabla de
 * layout automático fija el ancho mínimo de la columna al texto entero y deja el monto recortado
 * fuera de una pantalla de 360 px. El `title` conserva la ayuda nativa para textos simples sin
 * ocultar información. */
export function TablePrimaryCell({ value, sub }: TablePrimaryCellProps) {
  return (
    <div className="min-w-0">
      <div className="font-semibold text-rediseno-tinta">{value}</div>
      {sub && (
        <div
          className="mt-0.5 min-w-0 whitespace-normal break-words text-[12px] text-rediseno-tinta-3-light"
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
  /** Desactiva la paginación cliente cuando el endpoint ya entrega una página completa. */
  pagination?: boolean;
  onExport?: () => void;
  exportLabel?: string;
  emptyMessage?: string;
  /** Sustantivo del conteo del footer ("registros" por defecto; "clientes con saldo" en Cobrar). */
  countNoun?: string;
  /** Contenido extra del footer (§1.3 `.twf`): el total de la tabla con su apellido y su ⓘ. */
  footer?: React.ReactNode;
  /** Baja el padding lateral de celda de 18 a 10 px cuando la TABLA es angosta (< 640 px). Opt-in:
   *  18 px por lado cuestan 36 px por columna, y con tres columnas visibles son 108 px de los 360
   *  disponibles — la diferencia entre que el monto entre o no en pantallas chicas. Quien no lo
   *  pide conserva los 18 px en todo ancho. */
  celdasCompactasEnAngosto?: boolean;
  /** Identidad estable de fila para conservar estado local de controles al cambiar `data`. */
  rowKey?: (row: TData, index: number) => string;
  /** Hace la fila navegable sin sacrificar teclado. Los controles internos conservan su acción. */
  onRowClick?: (row: TData) => void;
  rowAriaLabel?: (row: TData) => string;
}

export function RedisenoTable<TData>({
  columns,
  data,
  totalCount,
  pageSize = 50,
  pagination = true,
  onExport,
  exportLabel = "Exportar",
  emptyMessage = "Sin resultados.",
  countNoun = "registros",
  footer,
  celdasCompactasEnAngosto = false,
  rowKey,
  onRowClick,
  rowAriaLabel,
}: RedisenoTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    getRowId: rowKey ? (row, index) => rowKey(row, index) : undefined,
    initialState: { pagination: { pageSize } },
  });

  const leafCols = table.getAllLeafColumns();
  const pageCount = pagination ? table.getPageCount() : 1;
  const pageIndex = table.getState().pagination.pageIndex;
  const total = totalCount ?? data.length;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie",
        /* `container-type: inline-size` sólo donde hace falta: es un contexto de contención y no
           se le impone a las tablas que no lo pidieron. */
        (celdasCompactasEnAngosto ||
          leafCols.some((c) => colMeta(c.columnDef.meta).hideBelowTable)) &&
          "@container",
      )}
    >
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
                        "whitespace-nowrap px-[18px] py-[11px] text-left font-rediseno-mono text-[12px] font-semibold tracking-[.1em] text-rediseno-tinta-3-light uppercase",
                        meta.align === "right" && "text-right",
                        celdasCompactasEnAngosto && "@max-[640px]:px-2.5",
                        clasesColapso(meta),
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
              <tr
                key={row.id}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? rowAriaLabel?.(row.original) : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row.original);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "border-b border-rediseno-hairline-row-2 last:border-b-0",
                  onRowClick &&
                    "cursor-pointer hover:bg-rediseno-neutro-bg focus-visible:bg-rediseno-neutro-bg focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rediseno-azul focus-visible:outline-none",
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = colMeta(cell.column.columnDef.meta);
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-[18px] py-3 align-baseline text-rediseno-tinta-2",
                        meta.align === "right" &&
                          "text-right font-semibold text-rediseno-tinta tabular-nums whitespace-nowrap",
                        celdasCompactasEnAngosto && "@max-[640px]:px-2.5",
                        clasesColapso(meta),
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
        <span>
          {total.toLocaleString("es-CL")} {countNoun}
        </span>
        {onExport && (
          <button type="button" onClick={onExport} className="font-bold text-rediseno-azul">
            {exportLabel}
          </button>
        )}
        {footer}
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
