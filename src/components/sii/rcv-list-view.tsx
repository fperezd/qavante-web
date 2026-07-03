"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Database,
  Inbox,
  Layers,
  Rows3,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
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
import { formatDateLike } from "@/lib/formatters/date";
import { SiiPeriodForm } from "./sii-period-form";
import { formatPeriodLabel } from "./sii-period-form-schema";
import { TIPO_DOC_FAMILIES, tipoDocMeta, type TipoDocFamily } from "./tipo-doc";
import { computeRcvTotals } from "./rcv-totals";
import { agruparConReferencias, type EstadoDoc, type FacturaRow } from "./rcv-anuladas";
import { RcvAsociadosModal } from "./rcv-asociados-modal";
import { RcvDetalleGrid } from "./rcv-detalle-grid";
import type { GroupedItem, RcvDoc } from "./rcv-grouped-item";
import { sortGroupedItems, toggleSort, type SortKey, type SortState } from "./rcv-sort";

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

const ESTADO_BADGE: Record<
  Exclude<EstadoDoc, "vigente">,
  { variant: "danger" | "warning"; label: string }
> = {
  anulada: { variant: "danger", label: "Anulada" },
  parcial: { variant: "warning", label: "Anulada parcial" },
};

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
  /** Selector de período custom (ej. filtro de rango con auto-carga). Si se
   *  provee, reemplaza al `SiiPeriodForm` mono-mes interno. Cuando se usa, el
   *  caller ya trae datos (no hay estado "sin consultar"): pasar `period`
   *  truthy + `headerLabel`. Aditivo — sin esto, comportamiento previo. */
  periodForm?: React.ReactNode;
  /** Etiqueta del header (ej. "feb-2026 a jul-2026"). Reemplaza a
   *  `formatPeriodLabel(period)` cuando se provee (modo rango). */
  headerLabel?: string;
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
      "El SII no tiene documentos de compra registrados para este período. Prueba con otro período o verifica con tu contador.",
    initialTitle: "Consulta tu Libro de Compras",
    initialDescription:
      "Elige un período y vas a ver las facturas, notas y otros documentos de compra que el SII tiene registrados a tu favor.",
    partyLabel: "Proveedor",
    hint: "Los datos del mes vigente típicamente no están completos hasta mediados del mes siguiente.",
    errorWhat: "el Libro de Compras del SII",
  },
  ventas: {
    emptyTitle: "Sin ventas en el período",
    emptyDescription:
      "El SII no tiene documentos de venta registrados para este período. Prueba con otro período o verifica con tu contador.",
    initialTitle: "Consulta tu Libro de Ventas",
    initialDescription:
      "Elige un período y vas a ver las facturas, notas y otros documentos de venta que el SII tiene registrados a tu nombre.",
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

export function RcvListView({
  kind,
  period,
  onPeriodChange,
  query,
  periodForm,
  headerLabel,
}: RcvListViewProps) {
  const copy = COPY[kind];
  const allDocs = extractDocs(query.data, kind);

  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);
  /* "agrupado" = facturas anuladas mostradas con sus NC vinculadas (estilo
     Chipax, default). "detalle" = lista plana documento por documento. */
  const [viewMode, setViewMode] = React.useState<"agrupado" | "detalle">("agrupado");
  const [selected, setSelected] = React.useState<FacturaRow<RcvDoc> | null>(null);
  /* Orden por columna (clic en el título): none → asc → desc → none. */
  const [sort, setSort] = React.useState<SortState | null>(null);

  const onToggleSort = React.useCallback((key: SortKey) => {
    setSort((s) => toggleSort(s, key));
    setPage(1);
  }, []);

  /* Cuando el período cambia, resetear página + filtros (el set de
     datos es completamente nuevo). */
  React.useEffect(() => {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  }, [period]);

  const filteredDocs = React.useMemo(() => applyFilters(allDocs, filters), [allDocs, filters]);

  /* Agrupación NC→factura (modo "agrupado"). Facturas primero, luego las NC
     huérfanas (sin factura del período). */
  const grouped = React.useMemo(() => agruparConReferencias(filteredDocs), [filteredDocs]);
  const groupedItems = React.useMemo<GroupedItem[]>(
    () => [
      ...grouped.rows.map((row) => ({ t: "fac" as const, row })),
      ...grouped.notasHuerfanas.map((doc) => ({ t: "nc" as const, doc })),
    ],
    [grouped],
  );

  /* Orden aplicado sobre el set agrupado (antes de paginar). El modo "detalle"
     usa la grilla dinámica (RcvDetalleGrid), que ordena/filtra/pagina por sí. */
  const sortedGrouped = React.useMemo(
    () => sortGroupedItems(groupedItems, sort),
    [groupedItems, sort],
  );

  const rowCount = groupedItems.length;
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedGrouped = React.useMemo(
    () => sortedGrouped.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedGrouped, currentPage, pageSize],
  );

  /* Totales sobre el SET FILTRADO COMPLETO (no solo la página actual). Netea las
     Notas de Crédito (restan) — antes se sumaban como una venta más, inflando el
     total. Ver computeRcvTotals (robusto al signo de la NC). */
  const totals = React.useMemo(() => computeRcvTotals(filteredDocs), [filteredDocs]);
  const anuladasCount = React.useMemo(
    () => grouped.rows.filter((r) => r.estado !== "vigente").length,
    [grouped],
  );

  const hasActiveFilters =
    filters.folio !== "" || filters.razonSocial !== "" || filters.tipoFamily !== "todos";

  return (
    <div className="space-y-4">
      {periodForm ?? (
        <SiiPeriodForm onSubmit={onPeriodChange} loading={query.isFetching} hint={copy.hint} />
      )}

      {!period && (
        <QavanteEmpty
          icon={Database}
          title={copy.initialTitle}
          description={copy.initialDescription}
        />
      )}

      {period && query.isLoading && (
        <div
          className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
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
              <span className="font-medium">{headerLabel ?? formatPeriodLabel(period)}</span>
              <div className="flex flex-wrap items-center gap-2">
                <QavanteBadge variant="info">
                  {filteredDocs.length} {filteredDocs.length === 1 ? "documento" : "documentos"}
                  {hasActiveFilters && allDocs.length !== filteredDocs.length && (
                    <span className="ml-1 text-xs opacity-80">de {allDocs.length}</span>
                  )}
                </QavanteBadge>
                {anuladasCount > 0 && (
                  <QavanteBadge variant="danger">
                    {anuladasCount} {anuladasCount === 1 ? "anulada" : "anuladas"}
                  </QavanteBadge>
                )}
                <QavanteButton
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setViewMode((m) => (m === "agrupado" ? "detalle" : "agrupado"));
                    setPage(1);
                  }}
                  aria-pressed={viewMode === "agrupado"}
                  title={
                    viewMode === "agrupado"
                      ? "Ver la lista plana, documento por documento"
                      : "Agrupar las notas de crédito con su factura"
                  }
                >
                  {viewMode === "agrupado" ? (
                    <>
                      <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Ver detalle
                    </>
                  ) : (
                    <>
                      <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                      Agrupar N/C
                    </>
                  )}
                </QavanteButton>
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
                description="Prueba removiendo filtros o cambiando el período. El backend SII solo permite filtrar por período; el resto de los filtros se aplican en pantalla sobre los documentos descargados."
              />
            ) : viewMode === "agrupado" ? (
              <>
                <GroupedTable
                  items={pagedGrouped}
                  totals={totals}
                  partyLabel={copy.partyLabel}
                  hasActiveFilters={hasActiveFilters}
                  onSelect={setSelected}
                  sort={sort}
                  onToggleSort={onToggleSort}
                />
                <PaginationBar
                  page={currentPage}
                  pageSize={pageSize}
                  totalRows={rowCount}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                />
              </>
            ) : (
              <RcvDetalleGrid
                docs={filteredDocs}
                totals={totals}
                partyLabel={copy.partyLabel}
                hasActiveFilters={hasActiveFilters}
              />
            )}

            <p className="text-xs text-neutral-mid">
              Datos descargados del SII en vivo. Las notas de crédito se descuentan del total
              {viewMode === "agrupado"
                ? " y se muestran vinculadas a su factura (haz clic en una fila anulada para ver los documentos asociados)"
                : ""}
              . Las sumas son referenciales y se calculan sobre los documentos mostrados — el dato
              oficial sigue siendo el del F29.
            </p>
          </div>
        </QavanteCard>
      )}

      {selected && (
        <RcvAsociadosModal
          row={selected}
          partyLabel={copy.partyLabel}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ── Tabla en modo "agrupado" (facturas + NC vinculadas, estilo Chipax) ──── */

/* Header ordenable: clic → asc/desc/none, con flechas. */
function SortHeader({
  label,
  sortKey,
  sort,
  onToggleSort,
  align,
  className,
}: {
  label: React.ReactNode;
  sortKey: SortKey;
  sort: SortState | null;
  onToggleSort: (key: SortKey) => void;
  align?: "right";
  className?: string;
}) {
  const dir = sort?.key === sortKey ? sort.dir : null;
  return (
    <th scope="col" className={cn("py-2 pr-3 font-semibold", align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => onToggleSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-neutral-dark",
          align === "right" && "flex-row-reverse",
        )}
        title="Ordenar por esta columna"
      >
        {label}
        {dir === "asc" ? (
          <ArrowUp className="h-3 w-3 text-brand-primary" aria-hidden="true" />
        ) : dir === "desc" ? (
          <ArrowDown className="h-3 w-3 text-brand-primary" aria-hidden="true" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

interface GroupedTableProps {
  items: GroupedItem[];
  totals: ReturnType<typeof computeRcvTotals>;
  partyLabel: string;
  hasActiveFilters: boolean;
  onSelect: (row: FacturaRow<RcvDoc>) => void;
  sort: SortState | null;
  onToggleSort: (key: SortKey) => void;
}

function GroupedTable({
  items,
  totals,
  partyLabel,
  hasActiveFilters,
  onSelect,
  sort,
  onToggleSort,
}: GroupedTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            <SortHeader label="Tipo" sortKey="tipo" sort={sort} onToggleSort={onToggleSort} />
            <SortHeader label="Folio" sortKey="folio" sort={sort} onToggleSort={onToggleSort} />
            <SortHeader label="Fecha" sortKey="fecha" sort={sort} onToggleSort={onToggleSort} />
            <SortHeader label={partyLabel} sortKey="cliente" sort={sort} onToggleSort={onToggleSort} />
            <SortHeader label="Neto" sortKey="neto" sort={sort} onToggleSort={onToggleSort} align="right" />
            <SortHeader label="IVA" sortKey="iva" sort={sort} onToggleSort={onToggleSort} align="right" />
            <SortHeader label="Total" sortKey="total" sort={sort} onToggleSort={onToggleSort} align="right" />
            <th scope="col" className="py-2 font-semibold">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            if (item.t === "nc") {
              // Nota de crédito huérfana (sin factura asociada en el período).
              const d = item.doc;
              const meta = tipoDocMeta(d.tipo_doc ?? null);
              return (
                <tr
                  key={`nc-${d.folio ?? "x"}-${i}`}
                  className="border-b border-border/60 last:border-b-0 hover:bg-surface-muted"
                >
                  <td className="py-2 pr-3">
                    <span
                      title={meta.label}
                      className="inline-block rounded bg-danger-50 px-1.5 py-0.5 font-mono text-[11px] text-danger-500"
                    >
                      {meta.abbr}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-neutral-dark">{d.folio ?? "—"}</td>
                  <td className="py-2 pr-3 text-neutral-dark">{formatDateLike(d.fecha)}</td>
                  <td className="py-2 pr-3">
                    <span className="block text-neutral-dark">{d.razon_social ?? "Sin nombre"}</span>
                    {d.rut_contraparte && (
                      <span className="block font-mono text-xs text-neutral-mid">
                        {d.rut_contraparte}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                    {typeof d.monto_neto === "number" ? `−${formatClp(Math.abs(d.monto_neto))}` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                    {typeof d.monto_iva === "number" ? `−${formatClp(Math.abs(d.monto_iva))}` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-danger-500">
                    {typeof d.monto_total === "number" ? `−${formatClp(Math.abs(d.monto_total))}` : "—"}
                  </td>
                  <td className="py-2 text-[11px] text-neutral-mid">Nota de crédito</td>
                </tr>
              );
            }

            const { row } = item;
            const f = row.factura;
            const meta = tipoDocMeta(f.tipo_doc ?? null);
            const anulada = row.estado === "anulada";
            const clickable = row.notas.length > 0;
            const badge = row.estado !== "vigente" ? ESTADO_BADGE[row.estado] : null;
            return (
              <tr
                key={`fac-${f.folio ?? "x"}-${i}`}
                onClick={clickable ? () => onSelect(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(row);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? "button" : undefined}
                className={cn(
                  "border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-muted",
                  clickable &&
                    "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary",
                  anulada && "text-neutral-mid",
                )}
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
                  <span className={cn(anulada && "line-through")}>{f.folio ?? "—"}</span>
                </td>
                <td className="py-2 pr-3 text-neutral-dark">{formatDateLike(f.fecha)}</td>
                <td className="py-2 pr-3">
                  <span className={cn("block text-neutral-dark", anulada && "line-through")}>
                    {f.razon_social ?? "Sin nombre"}
                  </span>
                  {f.rut_contraparte && (
                    <span className="block font-mono text-xs text-neutral-mid">
                      {f.rut_contraparte}
                    </span>
                  )}
                </td>
                <td
                  className={cn(
                    "py-2 pr-3 text-right tabular-nums text-neutral-dark",
                    anulada && "line-through",
                  )}
                >
                  {typeof f.monto_neto === "number" ? formatClp(f.monto_neto) : "—"}
                </td>
                <td
                  className={cn(
                    "py-2 pr-3 text-right tabular-nums text-neutral-mid",
                    anulada && "line-through",
                  )}
                >
                  {typeof f.monto_iva === "number" ? formatClp(f.monto_iva) : "—"}
                </td>
                <td
                  className={cn(
                    "py-2 pr-3 text-right tabular-nums font-medium text-neutral-dark",
                    anulada && "font-normal line-through",
                  )}
                >
                  {typeof f.monto_total === "number" ? formatClp(f.monto_total) : "—"}
                </td>
                <td className="py-2">
                  {badge ? (
                    <span className="inline-flex items-center gap-1.5">
                      <QavanteBadge variant={badge.variant}>
                        <XCircle className="mr-1 inline h-3 w-3" aria-hidden="true" />
                        {badge.label}
                      </QavanteBadge>
                      {row.sobreCredito && (
                        <span
                          className="text-[11px] font-medium text-danger-500"
                          title="Las notas de crédito superan el monto de la factura — posible error de referencia en el SII"
                        >
                          revisar
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5 text-xs text-brand-primary">
                        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                        asociados
                      </span>
                    </span>
                  ) : (
                    <span className="text-neutral-mid">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border-strong font-semibold">
            <td
              colSpan={4}
              className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
            >
              Total neto del período
              {hasActiveFilters && (
                <span className="ml-1 normal-case text-neutral-mid">(con filtros aplicados)</span>
              )}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
              {formatClp(totals.neto)}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
              {formatClp(totals.iva)}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
              {formatClp(totals.total)}
            </td>
            <td className="py-2" />
          </tr>
          {totals.ncCount > 0 && (
            <tr className="text-[11px] text-neutral-mid">
              <td colSpan={8} className="pb-2 pr-3">
                Se descontaron {totals.ncCount}{" "}
                {totals.ncCount === 1 ? "nota de crédito" : "notas de crédito"}: bruto{" "}
                <span className="tabular-nums">{formatClp(totals.grossTotal)}</span> − NC{" "}
                <span className="tabular-nums text-danger-500">{formatClp(totals.ncTotal)}</span> ={" "}
                neto <span className="tabular-nums">{formatClp(totals.total)}</span>.
              </td>
            </tr>
          )}
        </tfoot>
      </table>
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
      className="space-y-3 rounded-xl border border-border bg-surface-muted p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label
            htmlFor="rcv-filter-folio"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
          >
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
          <label
            htmlFor="rcv-filter-razon"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
          >
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
          <label
            htmlFor="rcv-filter-tipo"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
          >
            Tipo de documento
          </label>
          <select
            id="rcv-filter-tipo"
            value={value.tipoFamily}
            onChange={(e) => onChange({ ...value, tipoFamily: e.target.value as TipoDocFamily })}
            className={cn(
              "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-neutral-dark",
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
            className="ml-1 rounded-md border border-border bg-surface px-2 py-1 text-xs"
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
