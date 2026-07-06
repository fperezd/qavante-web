"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DynamicTable } from "@/components/table/dynamic-table";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { tipoDocMeta } from "./tipo-doc";
import { fechaSortKey } from "./rcv-sort";
import type { computeRcvTotals } from "./rcv-totals";
import type { RcvDoc } from "./rcv-grouped-item";
import { siiDteRecibidoPdfUrl } from "@/lib/api/sii";
import { DteActions } from "./dte-actions";

/** `DD/MM/YYYY` o `YYYY-MM-DD…` → `YYYY-MM-DD` (para el rango del PDF de DTE). */
function toIsoDate(fecha?: string): string | null {
  if (!fecha) return null;
  const s = fecha.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    if (d && mo && y) return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/* Grilla del Libro en modo "detalle" (lista plana): la tabla dinámica completa
   —ordenar (clic), mover columnas (arrastrar), filtrar por columna—. La vista
   "agrupado" (anuladas) queda con su render propio + orden por clic. */

export interface RcvDetalleGridProps {
  docs: RcvDoc[];
  totals: ReturnType<typeof computeRcvTotals>;
  partyLabel: string;
  hasActiveFilters: boolean;
  /** `compras` habilita la columna "DTE" (ver/descargar el PDF del proveedor).
   *  `ventas` la omite hasta que el backend acepte folio en dte-emitidos/pdf. */
  dteKind?: "compras" | "ventas";
}

export function RcvDetalleGrid({
  docs,
  totals,
  partyLabel,
  hasActiveFilters,
  dteKind,
}: RcvDetalleGridProps) {
  const columns = React.useMemo<ColumnDef<RcvDoc, unknown>[]>(
    () => [
      {
        id: "tipo",
        header: "Tipo",
        accessorFn: (d) => d.tipo_doc ?? -1,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const meta = tipoDocMeta(row.original.tipo_doc ?? null);
          return (
            <span
              title={meta.label}
              className="inline-block rounded bg-neutral-light/40 px-1.5 py-0.5 font-mono text-[11px] text-neutral-dark"
            >
              {meta.abbr}
            </span>
          );
        },
      },
      {
        id: "folio",
        header: "Folio",
        accessorFn: (d) => d.folio ?? "",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-neutral-dark">{row.original.folio ?? "—"}</span>
        ),
      },
      {
        id: "fecha",
        header: "Fecha",
        accessorFn: (d) => d.fecha ?? "",
        sortingFn: (a, b) => fechaSortKey(a.original.fecha) - fechaSortKey(b.original.fecha),
        cell: ({ row }) => (
          <span className="text-neutral-dark">{formatDateLike(row.original.fecha)}</span>
        ),
      },
      {
        id: "cliente",
        header: partyLabel,
        accessorFn: (d) => `${d.razon_social ?? ""} ${d.rut_contraparte ?? ""}`,
        cell: ({ row }) => (
          <div>
            <span className="block text-neutral-dark">
              {row.original.razon_social ?? "Sin nombre"}
            </span>
            {row.original.rut_contraparte && (
              <span className="block font-mono text-xs text-neutral-mid">
                {row.original.rut_contraparte}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "neto",
        header: "Neto",
        accessorFn: (d) =>
          typeof d.monto_neto === "number" ? d.monto_neto : Number.NEGATIVE_INFINITY,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) =>
          typeof row.original.monto_neto === "number" ? formatClp(row.original.monto_neto) : "—",
      },
      {
        id: "iva",
        header: "IVA",
        accessorFn: (d) =>
          typeof d.monto_iva === "number" ? d.monto_iva : Number.NEGATIVE_INFINITY,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) =>
          typeof row.original.monto_iva === "number" ? (
            <span className="text-neutral-mid">{formatClp(row.original.monto_iva)}</span>
          ) : (
            "—"
          ),
      },
      {
        id: "total",
        header: "Total",
        accessorFn: (d) =>
          typeof d.monto_total === "number" ? d.monto_total : Number.NEGATIVE_INFINITY,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) =>
          typeof row.original.monto_total === "number" ? (
            <span className="font-medium">{formatClp(row.original.monto_total)}</span>
          ) : (
            "—"
          ),
      },
      ...(dteKind === "compras"
        ? [
            {
              id: "dte",
              header: "DTE",
              enableColumnFilter: false,
              enableSorting: false,
              meta: { align: "right" as const },
              cell: ({ row }: { row: { original: RcvDoc } }) => {
                const iso = toIsoDate(row.original.fecha);
                const folio = row.original.folio ?? 0;
                return (
                  <DteActions
                    url={
                      iso
                        ? siiDteRecibidoPdfUrl({
                            desde: iso,
                            hasta: iso,
                            folio,
                            rutEmisor: row.original.rut_contraparte,
                          })
                        : null
                    }
                    label={`folio ${folio}`}
                  />
                );
              },
            } as ColumnDef<RcvDoc, unknown>,
          ]
        : []),
    ],
    [partyLabel, dteKind],
  );

  return (
    <div className="space-y-2">
      <DynamicTable columns={columns} data={docs} minWidth={720} />

      <div className="rounded-xl border border-border-strong bg-surface-muted px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            Total neto del período
            {hasActiveFilters && (
              <span className="ml-1 normal-case text-neutral-mid">(con filtros aplicados)</span>
            )}
          </span>
          <span className="tabular-nums text-neutral-dark">
            neto <strong>{formatClp(totals.neto)}</strong> · IVA{" "}
            <span className="text-neutral-mid">{formatClp(totals.iva)}</span> · total{" "}
            <strong>{formatClp(totals.total)}</strong>
          </span>
        </div>
        {totals.ncCount > 0 && (
          <p className="mt-1 text-[11px] text-neutral-mid">
            Se descontaron {totals.ncCount}{" "}
            {totals.ncCount === 1 ? "nota de crédito" : "notas de crédito"}: bruto{" "}
            <span className="tabular-nums">{formatClp(totals.grossTotal)}</span> − NC{" "}
            <span className="tabular-nums text-danger-500">{formatClp(totals.ncTotal)}</span> = neto{" "}
            <span className="tabular-nums">{formatClp(totals.total)}</span>.
          </p>
        )}
      </div>
    </div>
  );
}
