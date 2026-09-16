"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DynamicTable } from "@/components/table/dynamic-table";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { tipoDocMeta } from "./tipo-doc";
import { fechaSortKey } from "./rcv-sort";
import type { computeRcvTotals } from "./rcv-totals";
import { rcvDueDate, rcvDueDateIsEstimated, type RcvDoc } from "./rcv-grouped-item";
import type { RcvKind } from "./rcv-list-view";
import { DteActions } from "./dte-actions";
import { dtePdfUrlForDoc } from "./dte-pdf";
import { isDteCorrector, rcvSourceExternalId } from "./document-resolution-id";
import type { DocumentRowStatus } from "@/lib/api/reconciliation";
import { DocumentRowStatusBadges } from "./document-row-status";
import { resolveDocumentLink, type DteDocumentLink } from "@/lib/api/document-links";
import { DocumentLinkStatusBadge } from "./document-link-status";

/* Grilla del Libro en modo "detalle" (lista plana): la tabla dinámica permite
   ordenar, mover y filtrar columnas; la vista compacta conserva columnas fijas. */

export interface RcvDetalleGridProps {
  docs: RcvDoc[];
  totals: ReturnType<typeof computeRcvTotals>;
  partyLabel: string;
  hasActiveFilters: boolean;
  /** Habilita la columna "DTE" (ver/descargar el PDF): `compras` y `ventas`. */
  dteKind?: RcvKind;
  /** Ventana del rango consultado para armar la URL del PDF (ver dtePdfUrlForDoc). */
  dteWindow?: { desde: string; hasta: string } | null;
  onManageDocument?: (doc: RcvDoc) => void;
  statusById?: Map<string, DocumentRowStatus>;
  documentLinksIndex: ReadonlyMap<string, DteDocumentLink>;
  /** La consulta D07 falló: la fila dice "no disponible", nunca "sin evidencia". */
  documentLinksFailed?: boolean;
  /** La consulta D07 llegó al tope: un corrector ausente del índice dice "no disponible". */
  documentLinksTruncated?: boolean;
  documentLinksLoading?: boolean;
  /** Ventas puede traer el vencimiento enriquecido desde el backend. */
  showDueDate?: boolean;
}

function bridgeAmount(
  doc: RcvDoc,
  field: "neto_afecto" | "exento" | "iva" | "otros_ajustes_residual" | "total",
) {
  if (doc.complete !== true) return "incompleto";
  const value = doc[field];
  return typeof value === "number" ? formatClp(value) : "Sin información";
}

export function RcvDetalleGrid({
  docs,
  totals,
  partyLabel,
  hasActiveFilters,
  dteKind,
  dteWindow = null,
  onManageDocument,
  statusById,
  documentLinksIndex,
  documentLinksFailed = false,
  documentLinksTruncated = false,
  documentLinksLoading = false,
  showDueDate = false,
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
          <span className="font-mono text-xs text-neutral-dark">
            {row.original.folio ?? "Sin información"}
          </span>
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
      ...(showDueDate
        ? [
            {
              id: "vencimiento",
              header: "Vence",
              accessorFn: (d: RcvDoc) => rcvDueDate(d) ?? "",
              cell: ({ row }: { row: { original: RcvDoc } }) => (
                <span
                  className="text-neutral-dark"
                  title={
                    rcvDueDateIsEstimated(row.original)
                      ? "Fecha estimada: emisión + 30 días."
                      : undefined
                  }
                >
                  {rcvDueDate(row.original) ? (
                    formatDateLike(rcvDueDate(row.original))
                  ) : (
                    <span className="text-xs text-neutral-mid">No informada</span>
                  )}
                  {rcvDueDateIsEstimated(row.original) && (
                    <span className="ml-1 text-[10px] text-neutral-mid">estimado</span>
                  )}
                </span>
              ),
            } as ColumnDef<RcvDoc, unknown>,
          ]
        : []),
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
        id: "neto_afecto",
        header: "Neto afecto",
        accessorFn: (d) =>
          typeof d.neto_afecto === "number" ? d.neto_afecto : Number.NEGATIVE_INFINITY,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => bridgeAmount(row.original, "neto_afecto"),
      },
      {
        id: "exento",
        header: "Exento",
        accessorFn: (d) => (typeof d.exento === "number" ? d.exento : Number.NEGATIVE_INFINITY),
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => bridgeAmount(row.original, "exento"),
      },
      {
        id: "iva",
        header: "IVA",
        accessorFn: (d) => (typeof d.iva === "number" ? d.iva : Number.NEGATIVE_INFINITY),
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="text-neutral-mid">{bridgeAmount(row.original, "iva")}</span>
        ),
      },
      {
        id: "otros_ajustes",
        header: "Otros/ajustes",
        accessorFn: (d) =>
          typeof d.otros_ajustes_residual === "number"
            ? d.otros_ajustes_residual
            : Number.NEGATIVE_INFINITY,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => bridgeAmount(row.original, "otros_ajustes_residual"),
      },
      {
        id: "total",
        header: "Total",
        accessorFn: (d) => (typeof d.total === "number" ? d.total : Number.NEGATIVE_INFINITY),
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-medium">{bridgeAmount(row.original, "total")}</span>
        ),
      },
      {
        id: "evidencia-fiscal",
        header: "Evidencia fiscal",
        enableColumnFilter: false,
        enableSorting: false,
        cell: ({ row }) => {
          if (!isDteCorrector(row.original)) {
            return <span aria-label="Evidencia fiscal no aplica">·</span>;
          }
          const sourceExternalId = rcvSourceExternalId(row.original);
          const resolution = resolveDocumentLink(documentLinksIndex, sourceExternalId, {
            failed: documentLinksFailed,
            truncated: documentLinksTruncated,
          });
          return (
            <DocumentLinkStatusBadge
              resolution={resolution}
              loading={documentLinksLoading && Boolean(sourceExternalId)}
            />
          );
        },
      },
      ...(dteKind !== undefined
        ? [
            {
              id: "dte",
              header: "DTE",
              enableColumnFilter: false,
              enableSorting: false,
              meta: { align: "right" as const },
              cell: ({ row }: { row: { original: RcvDoc } }) => {
                const folio = row.original.folio ?? 0;
                return (
                  <DteActions
                    url={dtePdfUrlForDoc(dteKind, row.original, dteWindow)}
                    label={`folio ${folio}`}
                  />
                );
              },
            } as ColumnDef<RcvDoc, unknown>,
          ]
        : []),
      ...(onManageDocument
        ? [
            {
              id: "gestion",
              header: "Estado",
              enableColumnFilter: false,
              enableSorting: false,
              meta: { align: "right" as const },
              cell: ({ row }: { row: { original: RcvDoc } }) => (
                <DocumentRowStatusBadges
                  status={statusById?.get(rcvSourceExternalId(row.original) ?? "")}
                />
              ),
            } as ColumnDef<RcvDoc, unknown>,
          ]
        : []),
    ],
    [
      partyLabel,
      dteKind,
      dteWindow,
      showDueDate,
      onManageDocument,
      statusById,
      documentLinksIndex,
      documentLinksFailed,
      documentLinksTruncated,
      documentLinksLoading,
    ],
  );

  return (
    <div className="space-y-2">
      <DynamicTable
        columns={columns}
        data={docs}
        minWidth={showDueDate ? 1080 : 980}
        onRowActivate={onManageDocument}
      />

      <div className="rounded-xl border border-border-strong bg-surface-muted px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            Neto sin IVA del período
            {hasActiveFilters && (
              <span className="ml-1 normal-case text-neutral-mid">(con filtros aplicados)</span>
            )}
          </span>
          {totals.breakdown ? (
            <span className="tabular-nums text-neutral-dark">
              neto afecto <strong>{formatClp(totals.breakdown.netoAfecto)}</strong> · exento{" "}
              <strong>{formatClp(totals.breakdown.exento)}</strong> · neto sin IVA{" "}
              <strong>{formatClp(totals.breakdown.netoSinIva)}</strong> · IVA{" "}
              <span className="text-neutral-mid">{formatClp(totals.breakdown.iva)}</span> ·
              otros/ajustes{" "}
              <span className="text-neutral-mid">{formatClp(totals.breakdown.otrosAjustes)}</span> ·
              total <strong>{formatClp(totals.breakdown.total)}</strong>
            </span>
          ) : (
            <span className="text-neutral-mid">
              Cobertura incompleta: {totals.incompleteCount}{" "}
              {totals.incompleteCount === 1 ? "documento no tiene" : "documentos no tienen"}{" "}
              desglose canónico completo.
            </span>
          )}
        </div>
        {totals.ncCount > 0 &&
          totals.breakdown &&
          totals.grossTotal !== null &&
          totals.ncTotal !== null && (
            <p className="mt-1 text-[11px] text-neutral-mid">
              Se descontaron {totals.ncCount}{" "}
              {totals.ncCount === 1 ? "nota de crédito" : "notas de crédito"}: bruto{" "}
              <span className="tabular-nums">{formatClp(totals.grossTotal)}</span> − NC{" "}
              <span className="tabular-nums text-danger-500">{formatClp(totals.ncTotal)}</span> =
              neto <span className="tabular-nums">{formatClp(totals.breakdown.total)}</span>.
            </p>
          )}
      </div>
    </div>
  );
}
