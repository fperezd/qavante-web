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
import { ReclamadaBadge } from "@/components/sii/reclamada-badge";
import { type RcvComprasResponse, type RcvVentasResponse } from "@/lib/api/sii";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { SiiPeriodForm } from "./sii-period-form";
import { formatPeriodLabel } from "./sii-period-form-schema";
import { isNotaCredito, TIPO_DOC_FAMILIES, tipoDocMeta, type TipoDocFamily } from "./tipo-doc";
import { computeRcvTotals } from "./rcv-totals";
import { agruparVisibleConContexto } from "./rcv-anuladas";
import { RcvDetalleGrid } from "./rcv-detalle-grid";
import { LibroKpisPanel } from "./libro-kpis/libro-kpis-panel";
import { DteActions } from "./dte-actions";
import { periodToPdfWindow } from "./dte-date";
import { dtePdfUrlForDoc } from "./dte-pdf";
import { stickyScroll, stickyHead, stickyFoot } from "@/components/table/sticky-table";
import {
  rcvDueDate,
  rcvDueDateIsEstimated,
  type GroupedItem,
  type RcvDoc,
} from "./rcv-grouped-item";
import { sortGroupedItems, toggleSort, type SortKey, type SortState } from "./rcv-sort";
import {
  DocumentResolutionDrawer,
  type DocumentResolutionTarget,
} from "./document-resolution-drawer";
import { isDteCorrector, rcvSourceExternalId } from "./document-resolution-id";
import {
  useDocumentStatuses,
  type DocumentRowStatus,
  type DocumentStatusKey,
} from "@/lib/api/reconciliation";
import { DocumentRowStatusBadges } from "./document-row-status";
import {
  indexDocumentLinks,
  resolveDocumentLink,
  useDocumentLinks,
  type DocumentLinkKind,
  type DteDocumentLink,
} from "@/lib/api/document-links";
import { DocumentLinkStatusBadge } from "./document-link-status";

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
  /** Modo "solo tabla" del Libro v2 (aditivo, default false → comportamiento previo):
   *  oculta el filtro de período, el panel de KPIs y el selector compacta/detalle
   *  (los aporta el shell v2 alrededor). La tabla conserva cada DTE como fila propia. */
  tableOnly?: boolean;
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

function formatBridgeAmount(
  doc: RcvDoc,
  field: "neto_afecto" | "exento" | "iva" | "otros_ajustes_residual" | "total",
  negative = false,
) {
  if (doc.complete !== true) return "incompleto";
  const value = doc[field];
  if (typeof value !== "number") return "Sin información";
  return negative ? `−${formatClp(Math.abs(value))}` : formatClp(value);
}

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
  tableOnly = false,
}: RcvListViewProps) {
  const copy = COPY[kind];
  const allDocs = extractDocs(query.data, kind);
  /* Ventana (desde/hasta) para armar la URL del PDF de cada DTE: el rango
     COMPLETO consultado, no el mes de emisión de la fila (una factura emitida un
     mes y registrada en el RCV de otro no se encontraría por su mes de emisión). */
  const dteWindow = React.useMemo(() => periodToPdfWindow(period), [period]);

  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);
  /* Ambas vistas mantienen una fila por DTE. "compacta" usa columnas fijas;
     "detalle" permite configurar las columnas visibles. */
  const [viewMode, setViewMode] = React.useState<"compacta" | "detalle">("compacta");
  const [resolutionFilter, setResolutionFilter] = React.useState<
    "all" | "unreconciled" | "unclassified"
  >("all");
  const [resolutionTarget, setResolutionTarget] = React.useState<DocumentResolutionTarget | null>(
    null,
  );
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
  const documentLinkKind: DocumentLinkKind = kind === "ventas" ? "receivable" : "payable";
  /* D07 — una sola lectura por lado documental (`GET /api/sii/document-links`), indexada por el
     DTE corrector. La pantalla no pide resoluciones por lote: ese endpoint no existe. */
  const documentLinks = useDocumentLinks(
    documentLinkKind,
    Boolean(period && query.data && allDocs.length > 0),
  );
  const documentLinksIndex = React.useMemo(
    () => indexDocumentLinks(documentLinks.data),
    [documentLinks.data],
  );
  /* La pista legacy se evalúa contra todo el período descargado, antes de filtros,
     paginación y estados de gestión. Así un filtro visual no puede convertir dos
     candidatos en una falsa coincidencia única. El backend D07 reemplazará este
     contexto acotado por una resolución global y autoritativa. */
  const statusKind = kind === "ventas" ? "receivable" : "payable";
  const statusDocuments = React.useMemo<DocumentStatusKey[]>(
    () =>
      filteredDocs.flatMap((doc) => {
        const sourceExternalId = rcvSourceExternalId(doc);
        return sourceExternalId
          ? [{ document_kind: statusKind, source_external_id: sourceExternalId }]
          : [];
      }),
    [filteredDocs, statusKind],
  );
  const statuses = useDocumentStatuses(statusDocuments);
  const statusById = React.useMemo(
    () =>
      new Map<string, DocumentRowStatus>(
        (statuses.data?.items ?? []).map((item) => [item.source_external_id, item]),
      ),
    [statuses.data?.items],
  );
  const visibleDocs = React.useMemo(
    () =>
      filteredDocs.filter((doc) => {
        if (resolutionFilter === "all") return true;
        if (!statuses.isSuccess) return true;
        const status = statusById.get(rcvSourceExternalId(doc) ?? "");
        if (!status) return false;
        return resolutionFilter === "unreconciled"
          ? status.reconciliation_status !== "reconciled"
          : status.classification_status !== "classified";
      }),
    [filteredDocs, resolutionFilter, statusById, statuses.isSuccess],
  );

  /* Se reutiliza el shape legacy para ordenar/renderizar la vista compacta, pero
     visibleDocs sigue siendo la cardinalidad autoritativa: ninguna NC se anida ni oculta. */
  const compactContext = React.useMemo(
    () => agruparVisibleConContexto(allDocs, visibleDocs),
    [allDocs, visibleDocs],
  );
  const groupedItems = React.useMemo<GroupedItem[]>(() => {
    const rowsByDoc = new Map(compactContext.rows.map((row) => [row.factura, row]));
    const associationsByDoc = new Map(
      compactContext.asociacionesPendientes.map((association) => [association.nota, association]),
    );
    return visibleDocs.map((doc) => {
      if (isNotaCredito(doc.tipo_doc)) {
        return {
          t: "nc" as const,
          doc,
          association: associationsByDoc.get(doc) ?? {
            nota: doc,
            status: "unresolved",
            candidateFolios: [],
            reason: "no_candidate",
          },
        };
      }
      return {
        t: "fac" as const,
        row: rowsByDoc.get(doc) ?? {
          factura: doc,
          notas: [],
          neto: typeof doc.monto_total === "number" ? doc.monto_total : 0,
          estado: "vigente",
          matchExacto: true,
          sobreCredito: false,
        },
      };
    });
  }, [compactContext, visibleDocs]);

  /* Orden aplicado sobre el set compacto (antes de paginar). El modo "detalle"
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
  const totals = React.useMemo(() => computeRcvTotals(visibleDocs), [visibleDocs]);
  /* Sólo cuenta anulaciones que el productor acredita: `automatic_allowed` es su gate de
     evidencia trazable. Una referencia observada sin ese respaldo NO es una anulación. */
  const confirmedAnnulmentCount = React.useMemo(
    () =>
      Array.from(documentLinksIndex.values()).filter(
        (link: DteDocumentLink) =>
          link.link_status === "annulled_confirmed" && link.monetary_effect.automatic_allowed,
      ).length,
    [documentLinksIndex],
  );

  const hasActiveFilters =
    filters.folio !== "" || filters.razonSocial !== "" || filters.tipoFamily !== "todos";

  return (
    <div className="space-y-4">
      {!tableOnly &&
        (periodForm ?? (
          <SiiPeriodForm onSubmit={onPeriodChange} loading={query.isFetching} hint={copy.hint} />
        ))}

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

      {period && query.data && allDocs.length === 0 && !query.isLoading && !query.isError && (
        <QavanteEmpty icon={Inbox} title={copy.emptyTitle} description={copy.emptyDescription} />
      )}

      {period && allDocs.length > 0 && !tableOnly && (
        <LibroKpisPanel docs={filteredDocs} kind={kind} periodo={period} />
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
                {confirmedAnnulmentCount > 0 && (
                  <QavanteBadge variant="danger">
                    {confirmedAnnulmentCount}{" "}
                    {confirmedAnnulmentCount === 1
                      ? "anulación fiscal confirmada"
                      : "anulaciones fiscales confirmadas"}
                  </QavanteBadge>
                )}
                {!tableOnly && (
                  <QavanteButton
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setViewMode((m) => (m === "compacta" ? "detalle" : "compacta"));
                      setPage(1);
                    }}
                    aria-pressed={viewMode === "compacta"}
                    title={
                      viewMode === "compacta"
                        ? "Ver más columnas para cada documento"
                        : "Ver las columnas esenciales de cada documento"
                    }
                  >
                    {viewMode === "compacta" ? (
                      <>
                        <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
                        Ver detalle
                      </>
                    ) : (
                      <>
                        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                        Vista compacta
                      </>
                    )}
                  </QavanteButton>
                )}
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
            <div className="flex flex-wrap gap-2" aria-label="Filtrar por estado del documento">
              {(
                [
                  ["all", "Todos"],
                  ["unreconciled", "Por conciliar"],
                  ["unclassified", "Por clasificar"],
                ] as const
              ).map(([value, label]) => (
                <QavanteButton
                  key={value}
                  size="sm"
                  variant={resolutionFilter === value ? "secondary" : "ghost"}
                  aria-pressed={resolutionFilter === value}
                  onClick={() => {
                    setResolutionFilter(value);
                    setPage(1);
                  }}
                >
                  {label}
                </QavanteButton>
              ))}
            </div>
            {statuses.isFetching && resolutionFilter !== "all" && (
              <p className="text-xs text-neutral-mid" role="status">
                Consultando el estado de todos los documentos… Mientras carga no se ocultan filas.
              </p>
            )}
            {statuses.isError && (
              <QavanteInlineError
                error={statuses.error}
                what="los estados de clasificación y conciliación"
              />
            )}
            {documentLinks.isFetching && !documentLinks.data && (
              <p className="text-xs text-neutral-mid" role="status">
                Consultando evidencia fiscal… Los documentos conservan sus montos y estados.
              </p>
            )}
            {documentLinks.isError && (
              <p className="text-xs text-neutral-mid" role="status">
                La evidencia fiscal no estuvo disponible. Se mantiene la contención sin modificar
                montos, estados ni vencimientos.
              </p>
            )}
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
                description="Prueba removiendo filtros o cambiando el período. La fuente del SII permite consultar por período; los demás filtros se aplican sobre los documentos descargados."
              />
            ) : viewMode === "compacta" ? (
              <>
                <GroupedTable
                  items={pagedGrouped}
                  totals={totals}
                  partyLabel={copy.partyLabel}
                  hasActiveFilters={hasActiveFilters}
                  sort={sort}
                  onToggleSort={onToggleSort}
                  dteKind={kind}
                  dteWindow={dteWindow}
                  onManageDocument={(doc) => {
                    const sourceExternalId = rcvSourceExternalId(doc);
                    if (!sourceExternalId) return;
                    setResolutionTarget({
                      documentKind: kind === "ventas" ? "receivable" : "payable",
                      classificationSide: kind,
                      sourceExternalId,
                      label: `${tipoDocMeta(doc.tipo_doc ?? null).abbr} ${doc.folio ?? "Sin información"} · ${
                        doc.razon_social ?? "Sin nombre"
                      }`,
                    });
                  }}
                  statusById={statusById}
                  documentLinksIndex={documentLinksIndex}
                  documentLinksFailed={documentLinks.isError}
                  documentLinksLoading={documentLinks.isFetching && !documentLinks.data}
                  showDueDate={kind === "ventas"}
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
                docs={visibleDocs}
                totals={totals}
                partyLabel={copy.partyLabel}
                hasActiveFilters={hasActiveFilters}
                dteKind={kind}
                dteWindow={dteWindow}
                onManageDocument={(doc) => {
                  const sourceExternalId = rcvSourceExternalId(doc);
                  if (!sourceExternalId) return;
                  setResolutionTarget({
                    documentKind: kind === "ventas" ? "receivable" : "payable",
                    classificationSide: kind,
                    sourceExternalId,
                    label: `${tipoDocMeta(doc.tipo_doc ?? null).abbr} ${doc.folio ?? "Sin información"} · ${
                      doc.razon_social ?? "Sin nombre"
                    }`,
                  });
                }}
                statusById={statusById}
                documentLinksIndex={documentLinksIndex}
                documentLinksFailed={documentLinks.isError}
                documentLinksLoading={documentLinks.isFetching && !documentLinks.data}
                showDueDate={kind === "ventas"}
              />
            )}

            <p className="text-xs text-neutral-mid">
              Datos descargados del SII en vivo. Cada DTE y nota de crédito permanece en una fila
              separada. Las sumas son referenciales y se calculan sobre los documentos mostrados ·
              el dato oficial sigue siendo el del F29.
            </p>
          </div>
        </QavanteCard>
      )}

      <DocumentResolutionDrawer
        target={resolutionTarget}
        onClose={() => setResolutionTarget(null)}
      />
    </div>
  );
}

/* ── Tabla compacta: una fila independiente por cada DTE ──── */

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
    <th
      scope="col"
      className={cn("py-2 pr-3 font-semibold", align === "right" && "text-right", className)}
    >
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

export interface GroupedTableProps {
  items: GroupedItem[];
  totals: ReturnType<typeof computeRcvTotals>;
  partyLabel: string;
  hasActiveFilters: boolean;
  sort: SortState | null;
  onToggleSort: (key: SortKey) => void;
  /** Habilita la columna "DTE" (ver/descargar): `compras` y `ventas`. */
  dteKind?: RcvKind;
  /** Ventana del rango consultado para armar la URL del PDF (ver dtePdfUrlForDoc). */
  dteWindow?: { desde: string; hasta: string } | null;
  onManageDocument?: (doc: RcvDoc) => void;
  statusById?: Map<string, DocumentRowStatus>;
  documentLinksIndex: ReadonlyMap<string, DteDocumentLink>;
  /** La consulta D07 falló: las filas dicen "no disponible", nunca "sin evidencia". */
  documentLinksFailed?: boolean;
  documentLinksLoading?: boolean;
  /** Ventas puede traer el vencimiento enriquecido desde el backend. */
  showDueDate?: boolean;
}

/** Celda DTE (ver/descargar) de un documento del Libro (compras o ventas). */
function dteCell(kind: RcvKind, doc: RcvDoc, window: { desde: string; hasta: string } | null) {
  const folio = doc.folio ?? 0;
  return <DteActions url={dtePdfUrlForDoc(kind, doc, window)} label={`folio ${folio}`} />;
}

export function GroupedTable({
  items,
  totals,
  partyLabel,
  hasActiveFilters,
  sort,
  onToggleSort,
  dteKind,
  dteWindow = null,
  onManageDocument,
  statusById,
  documentLinksIndex,
  documentLinksFailed = false,
  documentLinksLoading = false,
  showDueDate = false,
}: GroupedTableProps) {
  const showDte = dteKind !== undefined;
  const documentLinksState = { failed: documentLinksFailed };
  return (
    <div className={stickyScroll}>
      <table className="w-full min-w-[760px] text-sm">
        <thead className={stickyHead}>
          <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            <SortHeader label="Tipo" sortKey="tipo" sort={sort} onToggleSort={onToggleSort} />
            <SortHeader label="Folio" sortKey="folio" sort={sort} onToggleSort={onToggleSort} />
            <SortHeader label="Fecha" sortKey="fecha" sort={sort} onToggleSort={onToggleSort} />
            {showDueDate && (
              <th scope="col" className="py-2 pr-3 font-semibold">
                Vence
              </th>
            )}
            <SortHeader
              label={partyLabel}
              sortKey="cliente"
              sort={sort}
              onToggleSort={onToggleSort}
            />
            <SortHeader
              label="Neto afecto"
              sortKey="neto"
              sort={sort}
              onToggleSort={onToggleSort}
              align="right"
            />
            <th scope="col" className="py-2 pr-3 text-right font-semibold">
              Exento
            </th>
            <SortHeader
              label="IVA"
              sortKey="iva"
              sort={sort}
              onToggleSort={onToggleSort}
              align="right"
            />
            <th scope="col" className="py-2 pr-3 text-right font-semibold">
              Otros/ajustes
            </th>
            <SortHeader
              label="Total"
              sortKey="total"
              sort={sort}
              onToggleSort={onToggleSort}
              align="right"
            />
            <th scope="col" className="py-2 font-semibold">
              Evidencia fiscal
            </th>
            {showDte && (
              <th scope="col" className="py-2 text-right font-semibold">
                DTE
              </th>
            )}
            {onManageDocument && (
              <th scope="col" className="py-2 text-right font-semibold">
                Gestión
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            if (item.t === "nc") {
              // Nota de crédito: siempre conserva una fila propia.
              const d = item.doc;
              const meta = tipoDocMeta(d.tipo_doc ?? null);
              const isCorrector = isDteCorrector(d);
              const sourceExternalId = rcvSourceExternalId(d);
              const documentLink = resolveDocumentLink(
                documentLinksIndex,
                sourceExternalId,
                documentLinksState,
              );
              return (
                <tr
                  key={`nc-${d.folio ?? "x"}-${i}`}
                  onClick={
                    onManageDocument
                      ? (event) => {
                          if ((event.target as HTMLElement).closest("a,button,input,select"))
                            return;
                          onManageDocument(d);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onManageDocument
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onManageDocument(d);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onManageDocument ? 0 : undefined}
                  className={cn(
                    "border-b border-border/60 last:border-b-0 hover:bg-surface-muted",
                    onManageDocument &&
                      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary",
                  )}
                >
                  <td className="py-2 pr-3">
                    <span
                      title={meta.label}
                      className="inline-block rounded bg-danger-50 px-1.5 py-0.5 font-mono text-[11px] text-danger-500"
                    >
                      {meta.abbr}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-neutral-dark">
                    {d.folio ?? "Sin información"}
                  </td>
                  <td className="py-2 pr-3 text-neutral-dark">{formatDateLike(d.fecha)}</td>
                  {showDueDate && (
                    <td
                      className="py-2 pr-3 text-neutral-mid"
                      title={
                        rcvDueDateIsEstimated(d) ? "Fecha estimada: emisión + 30 días." : undefined
                      }
                    >
                      {rcvDueDate(d) ? (
                        formatDateLike(rcvDueDate(d))
                      ) : (
                        <span className="text-xs">No informada</span>
                      )}
                      {rcvDueDateIsEstimated(d) && (
                        <span className="ml-1 text-[10px]">estimado</span>
                      )}
                    </td>
                  )}
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
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                    {formatBridgeAmount(d, "neto_afecto", true)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                    {formatBridgeAmount(d, "exento", true)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                    {formatBridgeAmount(d, "iva", true)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                    {formatBridgeAmount(d, "otros_ajustes_residual", true)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-danger-500">
                    {formatBridgeAmount(d, "total", true)}
                  </td>
                  <td className="py-2 text-[11px] text-neutral-mid">
                    {isCorrector ? (
                      <DocumentLinkStatusBadge
                        resolution={documentLink}
                        loading={documentLinksLoading && Boolean(sourceExternalId)}
                      />
                    ) : (
                      <span aria-label="Evidencia fiscal no aplica">·</span>
                    )}
                  </td>
                  {dteKind && <td className="py-2 text-right">{dteCell(dteKind, d, dteWindow)}</td>}
                  {onManageDocument && (
                    <td className="py-2 text-right">
                      <DocumentRowStatusBadges
                        status={statusById?.get(rcvSourceExternalId(d) ?? "")}
                      />
                    </td>
                  )}
                </tr>
              );
            }

            const { row } = item;
            const f = row.factura;
            const meta = tipoDocMeta(f.tipo_doc ?? null);
            const isCorrector = isDteCorrector(f);
            const clickable = Boolean(onManageDocument);
            const sourceExternalId = rcvSourceExternalId(f);
            const documentLink = resolveDocumentLink(
              documentLinksIndex,
              sourceExternalId,
              documentLinksState,
            );
            return (
              <tr
                key={`fac-${f.folio ?? "x"}-${i}`}
                onClick={
                  clickable
                    ? (event) => {
                        if ((event.target as HTMLElement).closest("a,button,input,select")) return;
                        onManageDocument?.(f);
                      }
                    : undefined
                }
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onManageDocument?.(f);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                className={cn(
                  "border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-muted",
                  clickable &&
                    "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary",
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
                  <span className="inline-flex items-center gap-1.5">
                    <span>{f.folio ?? "Sin información"}</span>
                    {f.reclamado === true && <ReclamadaBadge />}
                  </span>
                </td>
                <td className="py-2 pr-3 text-neutral-dark">{formatDateLike(f.fecha)}</td>
                {showDueDate && (
                  <td
                    className="py-2 pr-3 text-neutral-mid"
                    title={
                      rcvDueDateIsEstimated(f) ? "Fecha estimada: emisión + 30 días." : undefined
                    }
                  >
                    {rcvDueDate(f) ? (
                      formatDateLike(rcvDueDate(f))
                    ) : (
                      <span className="text-xs">No informada</span>
                    )}
                    {rcvDueDateIsEstimated(f) && <span className="ml-1 text-[10px]">estimado</span>}
                  </td>
                )}
                <td className="py-2 pr-3">
                  <span className="block text-neutral-dark">{f.razon_social ?? "Sin nombre"}</span>
                  {f.rut_contraparte && (
                    <span className="block font-mono text-xs text-neutral-mid">
                      {f.rut_contraparte}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                  {formatBridgeAmount(f, "neto_afecto")}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                  {formatBridgeAmount(f, "exento")}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                  {formatBridgeAmount(f, "iva")}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                  {formatBridgeAmount(f, "otros_ajustes_residual")}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums font-medium text-neutral-dark">
                  {formatBridgeAmount(f, "total")}
                </td>
                <td className="py-2">
                  {isCorrector ? (
                    <DocumentLinkStatusBadge
                      resolution={documentLink}
                      loading={documentLinksLoading && Boolean(sourceExternalId)}
                    />
                  ) : (
                    <span className="text-neutral-mid" aria-label="Evidencia fiscal no aplica">
                      ·
                    </span>
                  )}
                </td>
                {dteKind && <td className="py-2 text-right">{dteCell(dteKind, f, dteWindow)}</td>}
                {onManageDocument && (
                  <td className="py-2 text-right">
                    <DocumentRowStatusBadges
                      status={statusById?.get(rcvSourceExternalId(f) ?? "")}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot className={stickyFoot}>
          <tr className="border-t-2 border-border-strong font-semibold">
            <td
              colSpan={showDueDate ? 5 : 4}
              className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
            >
              Neto sin IVA del período
              {hasActiveFilters && (
                <span className="ml-1 normal-case text-neutral-mid">(con filtros aplicados)</span>
              )}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
              {totals.breakdown ? formatClp(totals.breakdown.netoAfecto) : "incompleto"}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
              {totals.breakdown ? formatClp(totals.breakdown.exento) : "incompleto"}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
              {totals.breakdown ? formatClp(totals.breakdown.iva) : "incompleto"}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
              {totals.breakdown ? formatClp(totals.breakdown.otrosAjustes) : "incompleto"}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
              {totals.breakdown ? formatClp(totals.breakdown.total) : "incompleto"}
            </td>
            <td className="py-2" />
            {showDte && <td className="py-2" />}
            {onManageDocument && <td className="py-2" />}
          </tr>
          {totals.breakdown === null && (
            <tr className="text-[11px] text-neutral-mid">
              <td
                colSpan={
                  10 + (showDte ? 1 : 0) + (showDueDate ? 1 : 0) + (onManageDocument ? 1 : 0)
                }
                className="pb-2 pr-3"
              >
                Cobertura incompleta: {totals.incompleteCount}{" "}
                {totals.incompleteCount === 1 ? "documento no tiene" : "documentos no tienen"}{" "}
                desglose canónico completo.
              </td>
            </tr>
          )}
          {totals.ncCount > 0 &&
            totals.breakdown &&
            totals.grossTotal !== null &&
            totals.ncTotal !== null && (
              <tr className="text-[11px] text-neutral-mid">
                <td
                  colSpan={
                    10 + (showDte ? 1 : 0) + (showDueDate ? 1 : 0) + (onManageDocument ? 1 : 0)
                  }
                  className="pb-2 pr-3"
                >
                  Se descontaron {totals.ncCount}{" "}
                  {totals.ncCount === 1 ? "nota de crédito" : "notas de crédito"}: bruto{" "}
                  <span className="tabular-nums">{formatClp(totals.grossTotal)}</span> − NC{" "}
                  <span className="tabular-nums text-danger-500">{formatClp(totals.ncTotal)}</span>{" "}
                  = total <span className="tabular-nums">{formatClp(totals.breakdown.total)}</span>.
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
