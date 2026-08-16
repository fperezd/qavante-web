"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Inbox, Pencil, SlidersHorizontal } from "lucide-react";
import {
  QavanteBadge,
  QavanteButton,
  QavanteCard,
  QavanteEmpty,
  QavanteInlineError,
  QavanteInput,
  SortHeader,
} from "@/components/qavante";
import { useTableSort, type SortColumn } from "@/lib/hooks/use-table-sort";
import { stickyScroll, stickyHead, stickyFoot } from "@/components/table/sticky-table";
import { cn } from "@/lib/utils";
import {
  useBankMovements,
  useBankAccounts,
  useCanonicalCategories,
  useClassifyBankMovement,
  type BankMovement,
  type ClassifyMovementRequest,
} from "@/lib/api/treasury";
import { useManagementAccountsTree } from "@/lib/api/management";
import { BankAccountFilter } from "@/components/treasury/bank-account-filter";
import {
  buildMultiCurrencyTotals,
  currencyByAccount,
  formatMovementAmount,
  hasMixedCurrencies,
  noTotalReason,
} from "@/components/caja/multi-currency";
import { MultiCurrencyTotalsBreakdown } from "@/components/caja/multi-currency-totals";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { DirectionSegment } from "@/components/filters/direction-segment";
import {
  presetRange,
  isInPeriodRange,
  orderRange,
  type PeriodRange,
} from "@/lib/period/period-range";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { ClassificationDrawer, type ClassificationDraft } from "./classification-drawer";
import { flattenManagementAccounts, toCanonicalCategoryOptions } from "./adapters";
import { ClasificadosStats } from "./clasificados-stats";
import { buildAccountsLookup, buildCategoriesLookup } from "./build-clasificados-stats";

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

/* El período se maneja aparte con `PeriodRangeFilter` (idéntico al Libro): un
   rango YYYY-MM que filtra client-side por la fecha del movimiento. El backend
   solo soporta `period=YYYY-MM` (un mes) → con rango descargamos amplio
   (`limit:500`) y filtramos acá. Los demás filtros (categoría/dirección/glosa)
   viven en `Filters`. */
interface Filters {
  canonicalCategory: string;
  searchText: string;
  direction: "todos" | "credit" | "debit";
}

const DEFAULT_FILTERS: Filters = {
  canonicalCategory: "todos",
  searchText: "",
  direction: "todos",
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/* Columnas ordenables de la grilla de clasificados (regla de producto). Por
   defecto: fecha, más nueva primero (es la lista cronológica de auditoría). */
const SORT_COLUMNS: SortColumn<BankMovement>[] = [
  { key: "fecha", kind: "date", get: (m) => m.date },
  { key: "glosa", kind: "text", get: (m) => m.description },
  { key: "categoria", kind: "text", get: (m) => m.canonical_category ?? "" },
  { key: "monto", kind: "number", get: (m) => Math.abs(Number(m.amount) || 0) },
];

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

export function ClasificadosView() {
  const categoriesQuery = useCanonicalCategories();
  const accountsQuery = useManagementAccountsTree();
  const classify = useClassifyBankMovement();
  const bankAccountsQuery = useBankAccounts();
  const bankAccounts = bankAccountsQuery.data?.items ?? [];
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(20);
  /* Filtro por cuenta (no mezclar CLP/USD — Clasificados tiene totales). Con
     monedas mezcladas se obliga a elegir una; el default (data-aware) se resuelve
     más abajo, cuando ya cargaron los movimientos. */
  const [accountId, setAccountId] = React.useState("");
  const didDefaultAccount = React.useRef(false);
  /* Filtro de rango de período (idéntico al Libro). Default el año en curso.
     Filtra client-side por la fecha del movimiento. */
  const [range, setRange] = React.useState<PeriodRange>(() => presetRange("este_ano"));
  /* Reclasificación inline: el user hace click en una row → guardamos
     ref al movimiento + abrimos el drawer del §17 con el draft prellenado
     desde la clasificación actual (initialDraft). */
  const [reclasifyTarget, setReclasifyTarget] = React.useState<BankMovement | null>(null);

  /* Filtros SERVER-SIDE del contrato (api PR #653, publicados en el snapshot
     OpenAPI): rango `period_from`/`period_to`, `direction` y `bank_account_id`.
     Antes se bajaban 500 movimientos "de todo" y se filtraba entero client-side,
     con lo que el aviso de alcance parcial comparaba contra un `total` que no
     correspondía al filtro visible. Ahora el backend acota y `total` es el del
     filtro real. Los mismos cortes se re-aplican client-side abajo: son
     idempotentes, así que la vista sigue correcta aunque el backend ignore alguno. */
  const ordered = React.useMemo(() => orderRange(range), [range]);
  const query = useBankMovements({
    status: "classified",
    periodFrom: ordered.desde,
    periodTo: ordered.hasta,
    ...(filters.direction !== "todos" && { direction: filters.direction }),
    ...(accountId && { bankAccountId: accountId }),
    limit: 500,
  });

  const allItems = query.data?.items ?? [];
  const categoryItems = categoriesQuery.data?.items ?? [];
  /* Default de cuenta data-aware: cuando cargan cuentas + movimientos, si hay
     monedas mezcladas, arranca en la cuenta con MÁS movimientos (evita caer en
     una cuenta vacía). Una sola vez; después respeta la elección del usuario. */
  React.useEffect(() => {
    if (didDefaultAccount.current) return;
    const accts = bankAccountsQuery.data?.items;
    const movs = query.data?.items;
    if (!accts || !movs) return;
    didDefaultAccount.current = true;
    if (accts.length > 1 && hasMixedCurrencies(accts)) {
      const counts = new Map<string, number>();
      for (const m of movs) counts.set(m.bank_account_id, (counts.get(m.bank_account_id) ?? 0) + 1);
      const best = [...accts].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0];
      if (best) setAccountId(best.id);
    }
  }, [bankAccountsQuery.data, query.data]);
  const currencyMap = React.useMemo(
    () => currencyByAccount(bankAccountsQuery.data?.items ?? []),
    [bankAccountsQuery.data],
  );
  const accountItems = React.useMemo(
    () =>
      allItems.filter(
        (m) => (!accountId || m.bank_account_id === accountId) && isInPeriodRange(m.date, range),
      ),
    [allItems, accountId, range],
  );

  const filtered = React.useMemo(
    () => applyFilters(accountItems, filters),
    [accountItems, filters],
  );
  /* Orden de la grilla (por defecto fecha, más nueva primero; regla de producto).
     Al cambiar de columna se vuelve a la página 1 (mostrar el nuevo tope). */
  const sort = useTableSort(SORT_COLUMNS, "fecha");
  const sorted = React.useMemo(() => sort.sorted(filtered), [sort, filtered]);
  const toggleSort = (key: string) => {
    sort.toggle(key);
    setPage(1);
  };
  /* Totales POR MONEDA (INV-FX-001). Antes la moneda del total se tomaba de la
     PRIMERA fila y se sumaba todo con ese rótulo: si se colaba un movimiento de
     otra moneda (o de una cuenta que no está en la lista de activas, cuya moneda
     no conocemos) el total quedaba mezclado y mal rotulado. Ahora los buckets se
     arman desde las filas reales: con una sola moneda conocida se muestra el total
     de siempre; con más de una, o con movimientos de moneda desconocida, se
     muestra el desglose por moneda y se declara que no se puede totalizar. Nunca
     se convierte (no hay tipo de cambio cableado acá) ni se asume CLP. */
  const totals = React.useMemo(
    () => buildMultiCurrencyTotals(filtered, currencyMap),
    [filtered, currencyMap],
  );
  const displayCurrency = totals.currency ?? undefined;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = React.useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  /* Total único: SOLO cuando hay una moneda y ninguna desconocida. Los débitos
     llegan con monto negativo del banco → los buckets guardan magnitudes y el neto
     es `ingresos − egresos` (mismo criterio que las celdas de fila). */
  const single = totals.totalizable ? totals.totals[0] : null;

  const hasActiveFilters =
    filters.canonicalCategory !== "todos" ||
    filters.searchText !== "" ||
    filters.direction !== "todos";
  /* Filtros que viven DENTRO del panel colapsable (categoría + glosa). La
     dirección ya no cuenta acá: es control de primer nivel (segmentado arriba). */
  const hasPanelFilters = filters.canonicalCategory !== "todos" || filters.searchText !== "";

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

  const categoriesLookup = React.useMemo(
    () => buildCategoriesLookup(categoryItems),
    [categoryItems],
  );
  const accountsLookup = React.useMemo(
    () => buildAccountsLookup(accountsQuery.data?.items ?? []),
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
    const target = reclasifyTarget;
    /* Clasificación previa (para el "Deshacer": re-aplicar los valores que tenía).
       Es un undo real y seguro — vuelve a PATCH la categoría anterior. */
    const prevAccountId = target.management_account_id;
    // `canonical_category` del movimiento es string (read drift-proof, api#670); el body de classify
    // espera la categoría canónica del enum → casteamos al tipo de escritura.
    const prevCategory = (target.canonical_category ??
      null) as ClassifyMovementRequest["canonical_category"];
    classify.mutate(
      {
        movementId: target.id,
        body: {
          management_account_id: draft.managementAccountId,
          canonical_category:
            (draft.canonicalCategory as ClassifyMovementRequest["canonical_category"]) ?? null,
          notes: draft.notes || null,
          create_rule: false,
        },
      },
      {
        onSuccess: () => {
          setReclasifyTarget(null);
          toast.success("Movimiento reclasificado", {
            description: `${target.description} · ${formatMovementAmount(Math.abs(Number(target.amount) || 0), currencyMap.get(target.bank_account_id))}`,
            ...(prevAccountId && {
              action: {
                label: "Deshacer",
                onClick: () =>
                  classify.mutate({
                    movementId: target.id,
                    body: {
                      management_account_id: prevAccountId,
                      canonical_category: prevCategory,
                      notes: null,
                      create_rule: false,
                    },
                  }),
              },
            }),
          });
        },
      },
    );
  }

  if (query.isLoading && allItems.length === 0) {
    return (
      <div
        className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
        aria-busy="true"
        aria-label="Cargando movimientos clasificados"
      />
    );
  }

  if (query.isError) {
    return <QavanteInlineError error={query.error} what="los movimientos clasificados" />;
  }

  /* Sin early-return por "0 movimientos": ahora el período, la dirección y la
     cuenta se filtran SERVER-SIDE, así que un resultado vacío casi siempre
     significa "no hay en este corte", no "no hay nada". Cortar acá dejaba al
     usuario sin la barra de filtros y sin forma de ampliar el rango. El vacío se
     resuelve más abajo, dentro de la card, con los filtros a la vista. */

  /* Señal de alcance parcial: el backend reporta más movimientos para el
     filtro server-side (rango + dirección + cuenta + status=classified) que los
     que descargamos con limit:500. Los filtros client-side (categoría/glosa) no
     entran en esta comparación — esos solo narrowean lo que ya tenemos. */
  const isPartial = (query.data?.total ?? 0) > allItems.length;

  return (
    <div className="space-y-4">
      {/* Filtros de primer nivel: rango de período (idéntico al Libro) +
          dirección cobrar/pagar (el corte que el usuario hace más seguido). */}
      <div className="flex flex-wrap items-center gap-2">
        <PeriodRangeFilter
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(1);
          }}
        />
        <DirectionSegment
          value={filters.direction}
          onChange={(dir) => {
            setFilters((prev) => ({ ...prev, direction: dir }));
            setPage(1);
          }}
          aria-label="Filtrar movimientos clasificados por dirección"
        />
      </div>

      <ClasificadosStats
        items={filtered}
        isPartial={isPartial}
        categoriesById={categoriesLookup}
        accountsById={accountsLookup}
        currency={displayCurrency}
        noTotalReason={noTotalReason(totals)}
        isLoading={query.isLoading}
        activeDirection={filters.direction === "todos" ? null : filters.direction}
        activeCanonicalCategory={
          filters.canonicalCategory === "todos" ? null : filters.canonicalCategory
        }
        onApplyDirectionFilter={(dir) => {
          /* `dir = null` significa "limpiar" (toggle desde una card activa). */
          setFilters((prev) => ({ ...prev, direction: dir ?? "todos" }));
          setPage(1);
        }}
        onApplyCanonicalCategoryFilter={(code) => {
          setFilters((prev) => ({ ...prev, canonicalCategory: code ?? "todos" }));
          setPage(1);
        }}
      />

      <QavanteCard
        variant="bordered"
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-success-600" aria-hidden="true" />
              Movimientos clasificados
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <BankAccountFilter
                accounts={bankAccounts}
                value={accountId}
                onChange={(id) => {
                  setAccountId(id);
                  setPage(1);
                }}
              />
              <QavanteBadge variant="success">
                {filtered.length} {filtered.length === 1 ? "movimiento" : "movimientos"}
                {hasActiveFilters && allItems.length !== filtered.length && (
                  <span className="ml-1 text-xs opacity-80">de {allItems.length}</span>
                )}
              </QavanteBadge>
              <QavanteButton
                size="sm"
                variant={filtersOpen || hasPanelFilters ? "secondary" : "ghost"}
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-controls="clasificados-filters"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Filtros
                {hasPanelFilters && (
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
            allItems.length === 0 ? (
              <QavanteEmpty
                icon={CheckCircle2}
                title="No hay movimientos clasificados en este corte"
                description="Prueba ampliando el rango de período, cambiando la cuenta o quitando el filtro de dirección. Cuando clasifiques movimientos desde Por clasificar vas a verlos aquí."
              />
            ) : (
              <QavanteEmpty
                icon={Inbox}
                title="Sin resultados para los filtros aplicados"
                description="Prueba quitando filtros o cambiando el período."
              />
            )
          ) : (
            <>
              <div className={stickyScroll}>
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead className={stickyHead}>
                    <tr className="border-b border-border-strong text-left">
                      <th scope="col" className="py-2 pr-3">
                        <SortHeader
                          label="Fecha"
                          active={sort.sortKey === "fecha"}
                          dir={sort.sortDir}
                          onClick={() => toggleSort("fecha")}
                        />
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        <SortHeader
                          label="Glosa"
                          active={sort.sortKey === "glosa"}
                          dir={sort.sortDir}
                          onClick={() => toggleSort("glosa")}
                        />
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        <SortHeader
                          label="Categoría"
                          active={sort.sortKey === "categoria"}
                          dir={sort.sortDir}
                          onClick={() => toggleSort("categoria")}
                        />
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
                      >
                        Dir.
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        <div className="flex justify-end">
                          <SortHeader
                            label="Monto"
                            align="right"
                            active={sort.sortKey === "monto"}
                            dir={sort.sortDir}
                            onClick={() => toggleSort("monto")}
                          />
                        </div>
                      </th>
                      <th scope="col" className="py-2 font-semibold">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-muted"
                      >
                        <td className="py-2 pr-3 text-neutral-dark">
                          {m.date ? formatDateLike(m.date) : "s/d"}
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
                          {formatMovementAmount(
                            Math.abs(Number(m.amount) || 0),
                            currencyMap.get(m.bank_account_id),
                          )}
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
                  <tfoot className={stickyFoot}>
                    {single ? (
                      <>
                        <tr className="border-t-2 border-border-strong font-semibold">
                          <td
                            colSpan={4}
                            className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
                          >
                            Neto del período · {single.currency}
                            {hasActiveFilters && (
                              <span className="ml-1 normal-case text-neutral-mid">
                                (con filtros aplicados)
                              </span>
                            )}
                          </td>
                          <td
                            className={cn(
                              "py-2 pr-3 text-right tabular-nums",
                              single.net >= 0 ? "text-success-700" : "text-warning-700",
                            )}
                          >
                            {single.net >= 0 ? "+" : "−"}{" "}
                            {formatMoney(Math.abs(single.net), single.currency)}
                          </td>
                          <td className="py-2" />
                        </tr>
                        <tr className="text-xs text-neutral-mid">
                          <td colSpan={4} className="py-1 pr-3 text-right">
                            Ingresos {formatMoney(single.credit, single.currency)} · Egresos{" "}
                            {formatMoney(single.debit, single.currency)}
                          </td>
                          <td className="py-1" colSpan={2} />
                        </tr>
                      </>
                    ) : (
                      /* Más de una moneda (o movimientos sin moneda conocida): NO
                         hay un total que mostrar. Desglose por moneda + el motivo,
                         en vez de una cifra mezclada (INV-FX-001). */
                      <tr className="border-t-2 border-border-strong">
                        <td colSpan={6} className="py-2">
                          <MultiCurrencyTotalsBreakdown
                            totals={totals}
                            label={
                              hasActiveFilters ? "Neto (con filtros aplicados)" : "Neto del período"
                            }
                          />
                        </td>
                      </tr>
                    )}
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
            Movimientos bancarios ya clasificados. Para reclasificar uno, haz clic en{" "}
            <span className="font-medium text-neutral-dark">Reclasificar</span> en su fila, el
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
            date: reclasifyTarget.date ? formatDateLike(reclasifyTarget.date) : "s/d",
            description: reclasifyTarget.description,
            bankLabel: `Cuenta ····${reclasifyTarget.bank_account_id.slice(-4)}`,
            amountFormatted: formatMovementAmount(
              Math.abs(Number(reclasifyTarget.amount) || 0),
              currencyMap.get(reclasifyTarget.bank_account_id),
            ),
          }}
          canonicalCategories={canonicalOptions}
          managementAccounts={accountOptions}
          dimensions={[]}
          saving={classify.isPending}
          title="Reclasificar movimiento"
          lifecycle={[
            {
              status: "done",
              title: "Detectado en tu banco",
              children: reclasifyTarget.date ? formatDateLike(reclasifyTarget.date) : "s/d",
            },
            {
              status: "done",
              title: "Clasificado",
              children:
                [
                  reclasifyTarget.management_account_id
                    ? accountsLookup.get(reclasifyTarget.management_account_id)?.name
                    : undefined,
                  reclasifyTarget.canonical_category
                    ? categoryLabelByCode[reclasifyTarget.canonical_category]
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Categoría de gestión asignada",
            },
          ]}
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
    "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-neutral-dark",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
  );

  return (
    <div
      id="clasificados-filters"
      className="space-y-3 rounded-xl border border-border bg-surface-muted p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <div className="space-y-1 sm:col-span-2">
          <label
            htmlFor="clasif-filter-categoria"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
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
        <div className="space-y-1 sm:col-span-3">
          <label
            htmlFor="clasif-filter-search"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
          >
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
