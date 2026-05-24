"use client";

import * as React from "react";
import { Database, Inbox, SlidersHorizontal } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  QavanteBadge,
  QavanteButton,
  QavanteCard,
  QavanteEmpty,
  QavanteInlineError,
  QavanteInput,
} from "@/components/qavante";
import { cn } from "@/lib/utils";
import type { RcvComprasResponse, RcvVentasResponse } from "@/lib/api/sii";
import { formatClp } from "@/lib/formatters/clp";
import { SiiPeriodForm } from "./sii-period-form";
import { formatPeriodLabel } from "./sii-period-form-schema";
import { TIPO_DOC_FAMILIES, tipoDocMeta, type TipoDocFamily } from "./tipo-doc";

/* Vista reusable para Libro de Compras / Libro de Ventas (Sprint C1
   PR-Lib, mejora 2026-05-24). Hoy el backend expone /api/sii/rcv/compras
   y /api/sii/rcv/ventas con el mismo shape slim. La presentación sigue
   convenciones del libro de compras chileno (FAC-EL, BOL-EL, NC-EL...)
   en lugar del lenguaje técnico "RCV".

   Diseño: el view es presentacional. Recibe la query resultante por
   prop. Filtros y paginación son LOCALES (client-side) sobre los
   documentos descargados — el backend no expone filtros granulares por
   tipo/folio/razón social (solo período). Trade-off aceptado: los
   períodos típicos PYME (mes) traen <500 docs, manejable en cliente.

   §17.4: FE no calcula finanzas — el total se computa como suma simple
   de los `monto_total` descargados (agregado visual). Disclaimer
   explícito en el footer: "dato oficial es el del F29". */

interface RcvDoc {
  tipo_doc?: number;
  folio?: number;
  fecha?: string;
  rut_contraparte?: string;
  razon_social?: string;
  monto_neto?: number;
  monto_iva?: number;
  monto_total?: number;
  [key: string]: unknown;
}

export type RcvKind = "compras" | "ventas";

export interface RcvListViewProps {
  /** `compras` o `ventas`. Determina copys, headers y endpoint que el
   *  page invoca antes de pasar la query. */
  kind: RcvKind;
  /** Período actualmente consultado (null = todavía no se consultó). */
  period: string | null;
  /** Callback cuando el user submitea un nuevo período (validado). */
  onPeriodChange: (periodo: string) => void;
  /** Query de TanStack — invocada por el page con el hook que
   *  corresponde (`useSiiRcvCompras` o `useSiiRcvVentas`). */
  query: UseQueryResult<RcvComprasResponse | RcvVentasResponse, unknown>;
}

const COPY: Record<
  RcvKind,
  {
    emptyTitle: string;
    emptyDescription: string;
    initialTitle: string;
    initialDescription: string;
    partyLabel: string;
    hint: string;
    errorWhat: string;
  }
> = {
  compras: {
    emptyTitle: "Sin compras en el período",
    emptyDescription:
      "El SII no tiene documentos de compra registrados para este período. Probá con otro período o verificá con tu contador.",
    initialTitle: "Consultá tu Libro de Compras",
    initialDescription:
      "Elegí un período y vas a ver las facturas, notas y otros documentos de compra que el SII tiene registrados a tu favor.",
    partyLabel: "Proveedor",
    hint: "Los datos del mes vigente típicamente no están completos hasta mediados del mes siguiente.",
    errorWhat: "el Libro de Compras del SII",
  },
  ventas: {
    emptyTitle: "Sin ventas en el período",
    emptyDescription:
      "El SII no tiene documentos de venta registrados para este período. Probá con otro período o verificá con tu contador.",
    initialTitle: "Consultá tu Libro de Ventas",
    initialDescription:
      "Elegí un período y vas a ver las facturas, notas y otros documentos de venta que el SII tiene registrados a tu nombre.",
    partyLabel: "Cliente",
    hint: "Los datos del mes vigente típicamente no están completos hasta mediados del mes siguiente.",
    errorWhat: "el Libro de Ventas del SII",
  },
};

function extractDocs(
  data: RcvComprasResponse | RcvVentasResponse | undefined,
  kind: RcvKind,
): RcvDoc[] {
  if (!data) return [];
  const arr =
    kind === "compras" ? (data as RcvComprasResponse).compras : (data as RcvVentasResponse).ventas;
  return (arr as RcvDoc[] | undefined) ?? [];
}

function sumField(docs: RcvDoc[], field: "monto_neto" | "monto_iva" | "monto_total"): number {
  return docs.reduce((acc, d) => {
    const v = d[field];
    return acc + (typeof v === "number" ? v : 0);
  }, 0);
}

interface Filters {
  folio: string;
  razonSocial: string;
  tipoFamily: TipoDocFamily;
}

const DEFAULT_FILTERS: Filters = {
  folio: "",
  razonSocial: "",
  tipoFamily: "todos",
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function applyFilters(docs: RcvDoc[], filters: Filters): RcvDoc[] {
  const folioQ = filters.folio.trim();
  const razonQ = filters.razonSocial.trim().toLowerCase();
  return docs.filter((d) => {
    if (folioQ && (!d.folio || !String(d.folio).includes(folioQ))) return false;
    if (razonQ) {
      const haystack = `${d.razon_social ?? ""} ${d.rut_contraparte ?? ""}`.toLowerCase();
      if (!haystack.includes(razonQ)) return false;
    }
    if (filters.tipoFamily !== "todos") {
      const family = tipoDocMeta(d.tipo_doc ?? null).family;
      if (family !== filters.tipoFamily) return false;
    }
    return true;
  });
}

export function RcvListView({ kind, period, onPeriodChange, query }: RcvListViewProps) {
  const copy = COPY[kind];
  const allDocs = extractDocs(query.data, kind);

  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);

  /* Cuando el período cambia, resetear página + filtros (el set de
     datos es completamente nuevo). */
  React.useEffect(() => {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  }, [period]);

  const filteredDocs = React.useMemo(() => applyFilters(allDocs, filters), [allDocs, filters]);
  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedDocs = React.useMemo(
    () => filteredDocs.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredDocs, currentPage, pageSize],
  );

  /* Totales sobre el SET FILTRADO COMPLETO (no solo la página actual)
     — el user quiere saber "el total del período filtrado", no del
     viewport. */
  const totals = React.useMemo(
    () => ({
      neto: sumField(filteredDocs, "monto_neto"),
      iva: sumField(filteredDocs, "monto_iva"),
      total: sumField(filteredDocs, "monto_total"),
    }),
    [filteredDocs],
  );

  const hasActiveFilters =
    filters.folio !== "" || filters.razonSocial !== "" || filters.tipoFamily !== "todos";

  return (
    <div className="space-y-4">
      <SiiPeriodForm onSubmit={onPeriodChange} loading={query.isFetching} hint={copy.hint} />

      {!period && (
        <QavanteEmpty
          icon={Database}
          title={copy.initialTitle}
          description={copy.initialDescription}
        />
      )}

      {period && query.isLoading && (
        <div
          className="h-32 animate-pulse rounded-md bg-neutral-light/30"
          aria-busy="true"
          aria-label="Consultando al SII"
        />
      )}

      {period && query.isError && <QavanteInlineError error={query.error} what={copy.errorWhat} />}

      {period && query.data && allDocs.length === 0 && (
        <QavanteEmpty icon={Inbox} title={copy.emptyTitle} description={copy.emptyDescription} />
      )}

      {period && allDocs.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{formatPeriodLabel(period)}</span>
              <div className="flex flex-wrap items-center gap-2">
                <QavanteBadge variant="info">
                  {filteredDocs.length} {filteredDocs.length === 1 ? "documento" : "documentos"}
                  {hasActiveFilters && allDocs.length !== filteredDocs.length && (
                    <span className="ml-1 text-xs opacity-80">de {allDocs.length}</span>
                  )}
                </QavanteBadge>
                <QavanteButton
                  size="sm"
                  variant={filtersOpen || hasActiveFilters ? "secondary" : "ghost"}
                  onClick={() => setFiltersOpen((v) => !v)}
                  aria-expanded={filtersOpen}
                  aria-controls="rcv-filters"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  Filtros
                  {hasActiveFilters && (
                    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-medium leading-none text-surface">
                      •
                    </span>
                  )}
                </QavanteButton>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            {filtersOpen && (
              <FiltersPanel
                kind={kind}
                value={filters}
                onChange={(next) => {
                  setFilters(next);
                  setPage(1);
                }}
                onReset={() => {
                  setFilters(DEFAULT_FILTERS);
                  setPage(1);
                }}
              />
            )}

            {filteredDocs.length === 0 ? (
              <QavanteEmpty
                icon={Inbox}
                title="Sin resultados para los filtros aplicados"
                description="Probá removiendo filtros o cambiando el período. El backend SII solo permite filtrar por período; el resto de los filtros se aplican en pantalla sobre los documentos descargados."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-neutral-light text-left text-xs uppercase tracking-wide text-neutral-mid">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Tipo
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Folio
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Fecha
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          {copy.partyLabel}
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Neto
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          IVA
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedDocs.map((d, i) => {
                        const meta = tipoDocMeta(d.tipo_doc ?? null);
                        return (
                          <tr
                            key={`${d.folio ?? "x"}-${d.rut_contraparte ?? i}-${i}`}
                            className="border-b border-neutral-light/40 last:border-b-0"
                          >
                            <td className="py-2 pr-3">
                              <span
                                title={meta.label}
                                className="inline-block rounded bg-neutral-light/40 px-1.5 py-0.5 font-mono text-[11px] text-neutral-dark"
                              >
                                {meta.abbr}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs text-neutral-dark">
                              {d.folio ?? "—"}
                            </td>
                            <td className="py-2 pr-3 text-neutral-dark">{d.fecha ?? "—"}</td>
                            <td className="py-2 pr-3">
                              <span className="block text-neutral-dark">
                                {d.razon_social ?? "Sin nombre"}
                              </span>
                              {d.rut_contraparte && (
                                <span className="block font-mono text-xs text-neutral-mid">
                                  {d.rut_contraparte}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                              {typeof d.monto_neto === "number" ? formatClp(d.monto_neto) : "—"}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                              {typeof d.monto_iva === "number" ? formatClp(d.monto_iva) : "—"}
                            </td>
                            <td className="py-2 text-right tabular-nums font-medium text-neutral-dark">
                              {typeof d.monto_total === "number" ? formatClp(d.monto_total) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-neutral-light/60 font-medium">
                        <td
                          colSpan={4}
                          className="py-2 pr-3 text-xs uppercase tracking-wide text-neutral-mid"
                        >
                          Totales del período
                          {hasActiveFilters && (
                            <span className="ml-1 normal-case text-neutral-mid">
                              (con filtros aplicados)
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                          {formatClp(totals.neto)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                          {formatClp(totals.iva)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-neutral-dark">
                          {formatClp(totals.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <PaginationBar
                  page={currentPage}
                  pageSize={pageSize}
                  totalRows={filteredDocs.length}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                />
              </>
            )}

            <p className="text-xs text-neutral-mid">
              Datos descargados del SII en vivo. Las sumas son referenciales y se calculan sobre los
              documentos mostrados — el dato oficial sigue siendo el del F29.
            </p>
          </div>
        </QavanteCard>
      )}
    </div>
  );
}

interface FiltersPanelProps {
  kind: RcvKind;
  value: Filters;
  onChange: (next: Filters) => void;
  onReset: () => void;
}

function FiltersPanel({ kind, value, onChange, onReset }: FiltersPanelProps) {
  return (
    <div
      id="rcv-filters"
      className="space-y-3 rounded-md border border-neutral-light bg-neutral-light/20 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="rcv-filter-folio" className="text-xs font-medium text-neutral-dark">
            Folio
          </label>
          <QavanteInput
            id="rcv-filter-folio"
            value={value.folio}
            onValueChange={(v) => onChange({ ...value, folio: v })}
            placeholder="Ej: 1001"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="rcv-filter-razon" className="text-xs font-medium text-neutral-dark">
            {kind === "compras" ? "Proveedor" : "Cliente"} o RUT
          </label>
          <QavanteInput
            id="rcv-filter-razon"
            value={value.razonSocial}
            onValueChange={(v) => onChange({ ...value, razonSocial: v })}
            placeholder={kind === "compras" ? "Buscar proveedor o RUT" : "Buscar cliente o RUT"}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="rcv-filter-tipo" className="text-xs font-medium text-neutral-dark">
            Tipo de documento
          </label>
          <select
            id="rcv-filter-tipo"
            value={value.tipoFamily}
            onChange={(e) => onChange({ ...value, tipoFamily: e.target.value as TipoDocFamily })}
            className={cn(
              "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
            )}
          >
            {TIPO_DOC_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <QavanteButton size="sm" variant="ghost" onClick={onReset}>
          Limpiar filtros
        </QavanteButton>
      </div>
    </div>
  );
}

interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function PaginationBar({
  page,
  pageSize,
  totalRows,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const from = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRows);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-neutral-mid">
        Mostrando{" "}
        <span className="font-medium text-neutral-dark">
          {from}–{to}
        </span>{" "}
        de <span className="font-medium text-neutral-dark">{totalRows}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-neutral-mid">
          Por página{" "}
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="ml-1 rounded-md border border-neutral-light bg-surface px-2 py-1 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <QavanteButton
            size="sm"
            variant="ghost"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            Anterior
          </QavanteButton>
          <span className="px-2 text-xs text-neutral-mid" aria-live="polite">
            {page} / {totalPages}
          </span>
          <QavanteButton
            size="sm"
            variant="ghost"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
          >
            Siguiente
          </QavanteButton>
        </div>
      </div>
    </div>
  );
}
