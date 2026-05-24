"use client";

import * as React from "react";
import { CheckCircle2, Inbox, Pencil, SlidersHorizontal } from "lucide-react";
import {
  QavanteBadge,
  QavanteButton,
  QavanteCard,
  QavanteEmpty,
  QavanteInlineError,
  QavanteInput,
} from "@/components/qavante";
import { cn } from "@/lib/utils";
import {
  useBankMovements,
  useCanonicalCategories,
  useClassifyBankMovement,
  type BankMovement,
} from "@/lib/api/treasury";
import { useManagementAccountsTree } from "@/lib/api/management";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
import { ClassificationDrawer, type ClassificationDraft } from "./classification-drawer";
import { flattenManagementAccounts, toCanonicalCategoryOptions } from "./adapters";

/* Vista de movimientos CLASIFICADOS — Sprint C2, primera pieza visible
   del modelo canónico. Complemento de `/caja/por-clasificar`: ahí están
   los movimientos pendientes; acá los ya clasificados (para auditoría +
   reclasificar si hace falta).

   Filtros locales (sobre los movimientos descargados del período):
   - Categoría canónica (dropdown desde useCanonicalCategories)
   - Glosa / contraparte (search)
   - Período (input YYYY-MM al backend)
   - Dirección (credit / debit)

   §17.4: el FE no edita ni inventa montos. Para reclasificar, el user
   va a `/caja/por-clasificar` o usa el drawer §17 (ese ya está cableado
   en por-clasificar-view, podemos linkearlo desde acá en PR siguiente). */

const DIRECTION_LABEL: Record<string, string> = {
  credit: "Ingreso",
  debit: "Egreso",
};

interface Filters {
  canonicalCategory: string;
  searchText: string;
  direction: "todos" | "credit" | "debit";
  period: string;
}

const DEFAULT_FILTERS: Filters = {
  canonicalCategory: "todos",
  searchText: "",
  direction: "todos",
  period: "",
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function applyFilters(items: BankMovement[], filters: Filters): BankMovement[] {
  const text = filters.searchText.trim().toLowerCase();
  return items.filter((m) => {
    if (filters.canonicalCategory !== "todos") {
      if (m.canonical_category !== filters.canonicalCategory) return false;
    }
    if (filters.direction !== "todos") {
      if (m.direction !== filters.direction) return false;
    }
    if (text) {
      if (!m.description.toLowerCase().includes(text)) return false;
    }
    return true;
  });
}

function sumAmount(items: BankMovement[]): number {
  return items.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
}

export function ClasificadosView() {
  const categoriesQuery = useCanonicalCategories();
  const accountsQuery = useManagementAccountsTree();
  const classify = useClassifyBankMovement();
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);
  /* Reclasificación inline: el user hace click en una row → guardamos
     ref al movimiento + abrimos el drawer del §17 con el draft prellenado
     desde la clasificación actual (initialDraft). */
  const [reclasifyTarget, setReclasifyTarget] = React.useState<BankMovement | null>(null);

  const query = useBankMovements({
    status: "classified",
    ...(filters.period ? { period: filters.period } : {}),
    limit: 500, // backend default; pedimos amplio para filtrar client-side
  });

  const allItems = query.data?.items ?? [];
  const categoryItems = categoriesQuery.data?.items ?? [];

  const filtered = React.useMemo(() => applyFilters(allItems, filters), [allItems, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = React.useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  const totalCredit = React.useMemo(
    () => sumAmount(filtered.filter((m) => m.direction === "credit")),
    [filtered],
  );
  const totalDebit = React.useMemo(
    () => sumAmount(filtered.filter((m) => m.direction === "debit")),
    [filtered],
  );
  const neto = totalCredit - totalDebit;

  const hasActiveFilters =
    filters.canonicalCategory !== "todos" ||
    filters.searchText !== "" ||
    filters.direction !== "todos" ||
    filters.period !== "";

  const categoryLabelByCode = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categoryItems) map[c.code] = c.label;
    return map;
  }, [categoryItems]);

  const canonicalOptions = React.useMemo(
    () => toCanonicalCategoryOptions(categoryItems),
    [categoryItems],
  );
  const accountOptions = React.useMemo(
    () => flattenManagementAccounts(accountsQuery.data?.items ?? []),
    [accountsQuery.data],
  );

  /* Draft inicial para el drawer cuando se reclasifica: clona la
     clasificación actual del movimiento target. Cuando target === null
     el drawer está cerrado y este valor no se usa. */
  const reclasifyDraft = React.useMemo<ClassificationDraft | undefined>(() => {
    if (!reclasifyTarget) return undefined;
    return {
      canonicalCategory: reclasifyTarget.canonical_category ?? undefined,
      managementAccountId: reclasifyTarget.management_account_id ?? undefined,
      dimensionAssignments: {},
      notes: "",
    };
  }, [reclasifyTarget]);

  function handleReclasifySave(draft: ClassificationDraft) {
    if (!reclasifyTarget || !draft.managementAccountId) return;
    classify.mutate(
      {
        movementId: reclasifyTarget.id,
        body: {
          management_account_id: draft.managementAccountId,
          canonical_category:
            (draft.canonicalCategory as BankMovement["canonical_category"]) ?? null,
          notes: draft.notes || null,
          create_rule: false,
        },
      },
      {
        onSuccess: () => setReclasifyTarget(null),
      },
    );
  }

  if (query.isLoading && allItems.length === 0) {
    return (
      <div
        className="h-32 animate-pulse rounded-md bg-neutral-light/30"
        aria-busy="true"
        aria-label="Cargando movimientos clasificados"
      />
    );
  }

  if (query.isError) {
    return <QavanteInlineError error={query.error} what="los movimientos clasificados" />;
  }

  if (allItems.length === 0) {
    return (
      <QavanteEmpty
        icon={CheckCircle2}
        title="Aún no hay movimientos clasificados"
        description="Cuando clasifiques movimientos desde Por clasificar, vas a verlos acá. Podés filtrarlos por categoría, período y dirección."
      />
    );
  }

  return (
    <div className="space-y-4">
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-success-600" aria-hidden="true" />
              Movimientos clasificados
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <QavanteBadge variant="success">
                {filtered.length} {filtered.length === 1 ? "movimiento" : "movimientos"}
                {hasActiveFilters && allItems.length !== filtered.length && (
                  <span className="ml-1 text-xs opacity-80">de {allItems.length}</span>
                )}
              </QavanteBadge>
              <QavanteButton
                size="sm"
                variant={filtersOpen || hasActiveFilters ? "secondary" : "ghost"}
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-controls="clasificados-filters"
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
              value={filters}
              onChange={(next) => {
                setFilters(next);
                setPage(1);
              }}
              onReset={() => {
                setFilters(DEFAULT_FILTERS);
                setPage(1);
              }}
              categories={categoryItems}
            />
          )}

          {filtered.length === 0 ? (
            <QavanteEmpty
              icon={Inbox}
              title="Sin resultados para los filtros aplicados"
              description="Probá removiendo filtros o cambiando el período."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-light text-left text-xs uppercase tracking-wide text-neutral-mid">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Fecha
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Glosa
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Categoría
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Dir.
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Monto
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((m) => (
                      <tr key={m.id} className="border-b border-neutral-light/40 last:border-b-0">
                        <td className="py-2 pr-3 text-neutral-dark">
                          {m.date ? formatDate(new Date(m.date)) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-neutral-dark" title={m.description}>
                          <span className="line-clamp-2 max-w-[320px]">{m.description}</span>
                        </td>
                        <td className="py-2 pr-3 text-neutral-mid">
                          {m.canonical_category ? (
                            <QavanteBadge variant="info">
                              {categoryLabelByCode[m.canonical_category] ?? m.canonical_category}
                            </QavanteBadge>
                          ) : (
                            <span className="text-xs text-neutral-mid">Sin categoría</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={cn(
                              "inline-block rounded px-1.5 py-0.5 font-mono text-[11px]",
                              m.direction === "credit"
                                ? "bg-success-500/10 text-success-700"
                                : "bg-warning-500/10 text-warning-700",
                            )}
                          >
                            {DIRECTION_LABEL[m.direction] ?? m.direction}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "py-2 pr-3 text-right tabular-nums font-medium",
                            m.direction === "credit" ? "text-success-700" : "text-neutral-dark",
                          )}
                        >
                          {m.direction === "credit" ? "+" : "−"}{" "}
                          {formatClp(Math.abs(Number(m.amount) || 0))}
                        </td>
                        <td className="py-2 text-right">
                          <QavanteButton
                            size="sm"
                            variant="ghost"
                            onClick={() => setReclasifyTarget(m)}
                            aria-label={`Reclasificar movimiento ${m.description}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">Reclasificar</span>
                          </QavanteButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-neutral-light/60 font-medium">
                      <td
                        colSpan={4}
                        className="py-2 pr-3 text-xs uppercase tracking-wide text-neutral-mid"
                      >
                        Neto del período
                        {hasActiveFilters && (
                          <span className="ml-1 normal-case text-neutral-mid">
                            (con filtros aplicados)
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 text-right tabular-nums",
                          neto >= 0 ? "text-success-700" : "text-warning-700",
                        )}
                      >
                        {neto >= 0 ? "+" : "−"} {formatClp(Math.abs(neto))}
                      </td>
                      <td className="py-2" />
                    </tr>
                    <tr className="text-xs text-neutral-mid">
                      <td colSpan={4} className="py-1 pr-3 text-right">
                        Ingresos {formatClp(totalCredit)} · Egresos {formatClp(totalDebit)}
                      </td>
                      <td className="py-1" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <PaginationBar
                page={currentPage}
                pageSize={pageSize}
                totalRows={filtered.length}
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
            Movimientos bancarios ya clasificados. Para reclasificar uno, andá a Para reclasificar
            un movimiento, hacé click en{" "}
            <span className="font-medium text-neutral-dark">Reclasificar</span> en su fila — el
            drawer del flujo §17 abre con la clasificación actual prellenada.
          </p>
        </div>
      </QavanteCard>

      {reclasifyTarget && (
        <ClassificationDrawer
          key={reclasifyTarget.id}
          open
          onClose={() => setReclasifyTarget(null)}
          movement={{
            date: reclasifyTarget.date ? formatDate(new Date(reclasifyTarget.date)) : "—",
            description: reclasifyTarget.description,
            bankLabel: `Cuenta ····${reclasifyTarget.bank_account_id.slice(-4)}`,
            amountFormatted: formatClp(Math.abs(Number(reclasifyTarget.amount) || 0)),
          }}
          canonicalCategories={canonicalOptions}
          managementAccounts={accountOptions}
          dimensions={[]}
          saving={classify.isPending}
          title="Reclasificar movimiento"
          initialDraft={reclasifyDraft}
          onSave={handleReclasifySave}
          onSaveAndCreateRule={(d) => {
            /* Mismo handler que onSave; el create_rule no aplica a una
               reclasificación (la regla se basa en clasificación nueva,
               para eso está /caja/por-clasificar). */
            handleReclasifySave(d);
          }}
          onMarkForReview={() => setReclasifyTarget(null)}
        />
      )}

      {classify.isError && (
        <QavanteInlineError error={classify.error} what="al guardar la nueva clasificación" />
      )}
    </div>
  );
}

interface FiltersPanelProps {
  value: Filters;
  onChange: (next: Filters) => void;
  onReset: () => void;
  categories: Array<{ code: string; label: string }>;
}

function FiltersPanel({ value, onChange, onReset, categories }: FiltersPanelProps) {
  const selectClass = cn(
    "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
  );

  return (
    <div
      id="clasificados-filters"
      className="space-y-3 rounded-md border border-neutral-light bg-neutral-light/20 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <label
            htmlFor="clasif-filter-categoria"
            className="text-xs font-medium text-neutral-dark"
          >
            Categoría
          </label>
          <select
            id="clasif-filter-categoria"
            value={value.canonicalCategory}
            onChange={(e) => onChange({ ...value, canonicalCategory: e.target.value })}
            className={selectClass}
          >
            <option value="todos">Todas</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="clasif-filter-dir" className="text-xs font-medium text-neutral-dark">
            Dirección
          </label>
          <select
            id="clasif-filter-dir"
            value={value.direction}
            onChange={(e) =>
              onChange({ ...value, direction: e.target.value as Filters["direction"] })
            }
            className={selectClass}
          >
            <option value="todos">Todas</option>
            <option value="credit">Ingresos</option>
            <option value="debit">Egresos</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="clasif-filter-period" className="text-xs font-medium text-neutral-dark">
            Período
          </label>
          <QavanteInput
            id="clasif-filter-period"
            value={value.period}
            onValueChange={(v) => onChange({ ...value, period: v })}
            placeholder="2026-04"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="clasif-filter-search" className="text-xs font-medium text-neutral-dark">
            Glosa
          </label>
          <QavanteInput
            id="clasif-filter-search"
            value={value.searchText}
            onValueChange={(v) => onChange({ ...value, searchText: v })}
            placeholder="Buscar en descripción"
            autoComplete="off"
          />
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
