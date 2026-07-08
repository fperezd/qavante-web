"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Dialog } from "@base-ui/react/dialog";
import { CheckCircle2, ListChecks, RefreshCw } from "lucide-react";
import { QavanteEmpty, QavanteButton, QavanteInlineError } from "@/components/qavante";
import { cn } from "@/lib/utils";
import {
  useBankMovements,
  useBankAccounts,
  useClassifyBankMovement,
  useCanonicalCategories,
  type BankMovement,
} from "@/lib/api/treasury";
import { BankAccountFilter, currencyByAccount } from "@/components/treasury/bank-account-filter";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { presetRange, isInPeriodRange, type PeriodRange } from "@/lib/period/period-range";
import { formatMoney } from "@/lib/formatters/clp";
import {
  useManagementAccountsTree,
  useClassificationDimensions,
  useCreateDimensionAssignment,
} from "@/lib/api/management";
import type { SuggestRuleResponse } from "@/lib/api/classification-rules";
import { formatDateLike } from "@/lib/formatters/date";
import {
  ClassificationDrawer,
  type ClassificationDimension,
  type ClassificationDraft,
} from "./classification-drawer";
import { SuggestRuleBanner } from "./suggest-rule-banner";
import {
  flattenManagementAccounts,
  toCanonicalCategoryOptions,
  toDimensionValueOptions,
} from "./adapters";

/* Lazy: separa Base UI Dialog + RHF + zod del First Load de
   /caja/por-clasificar. Solo se descarga si el user pide crear regla
   desde una sugerencia. ssr:false porque el dialog es client-only. */
const RuleFormDialog = dynamic(
  () =>
    import("@/components/reglas/rule-form-dialog").then((m) => ({
      default: m.RuleFormDialog,
    })),
  { ssr: false },
);

/* Flujo §17 — Movimientos por clasificar. Patrón "página = contenedor" del
   repo: el screen resuelve el flag (server) y monta esto (client).
   Contrato real (regla 16, addendum §17.3 erróneo): classify es PATCH y
   `management_account_id` es OBLIGATORIO (422 sin él). §17.4: el resumen del
   movimiento es read-only (no se edita glosa/fecha/monto).

   D3 — asignación de dimensiones: el contrato NO acepta `dimension_assignments`
   inline en classify → se crean aparte (`POST /dimension-assignments`) tras
   clasificar. Gateado por `dimensionsEnabled` (flag `managementDimensions`):
   OFF ⇒ no se fetchean dimensiones (el endpoint sigue api-key-only y un 401 con
   cookie podría gatillar el redirect a /login) y el drawer va con
   `dimensions={[]}` (sección oculta) — comportamiento idéntico al previo. */

function LoadingSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-neutral-light/30" />
      ))}
    </div>
  );
}

function movementSummary(m: BankMovement, currency?: string) {
  const sign = m.direction === "credit" ? "+" : "−";
  return {
    date: m.date ? formatDateLike(m.date) : "—",
    description: m.description,
    // §17.1: no mostrar número de cuenta completo.
    bankLabel: `Cuenta ····${m.bank_account_id.slice(-4)}`,
    // Dirección + moneda: un egreso no se ve igual que un ingreso.
    amountFormatted: `${sign} ${formatMoney(Math.abs(Number(m.amount) || 0), currency)}`,
  };
}

export interface PorClasificarViewProps {
  /** Flag `managementDimensions`. OFF ⇒ no se fetchean dimensiones ni se
   *  muestran/crean asignaciones (default, comportamiento previo). */
  dimensionsEnabled?: boolean;
}

export function PorClasificarView({ dimensionsEnabled = false }: PorClasificarViewProps = {}) {
  const movementsQuery = useBankMovements({ status: "unclassified", limit: 500 });
  const canonicalQuery = useCanonicalCategories();
  const accountsQuery = useManagementAccountsTree();
  const bankAccountsQuery = useBankAccounts();
  const classify = useClassifyBankMovement();
  const dims = useClassificationDimensions(dimensionsEnabled);
  const assign = useCreateDimensionAssignment();

  const [selected, setSelected] = React.useState<BankMovement | null>(null);
  const [formError, setFormError] = React.useState<string>();
  /* Filtro por cuenta bancaria (no mezclar CLP/USD). "" = todas (solo si no hay
     monedas mezcladas). Con monedas mezcladas se arranca en la primera cuenta. */
  /* Sin default forzado: "Por clasificar" es una LISTA sin total → mostramos
     todas las cuentas juntas ("" = todas), cada fila formateada en su moneda. No
     hay total que mezclar, así que no hace falta obligar a elegir una cuenta. */
  const [accountId, setAccountId] = React.useState("");
  const bankAccounts = bankAccountsQuery.data?.items ?? [];
  /* Filtro de rango de período (idéntico al Libro). Filtra los pendientes por la
     fecha del movimiento; default el año en curso. */
  const [range, setRange] = React.useState<PeriodRange>(() => presetRange("este_ano"));
  const passes = React.useCallback(
    (m: BankMovement) =>
      (!accountId || m.bank_account_id === accountId) && isInPeriodRange(m.date, range),
    [accountId, range],
  );
  /* Triage por teclado (nivel dios): ↑↓ mueven la fila activa, Enter abre el
     drawer para clasificarla. `active` indexa `movements`; se acota cuando la
     lista cambia (al clasificar, la fila desaparece). */
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const rawItems = movementsQuery.data?.items ?? [];
  const itemCount = rawItems.filter(passes).length;
  React.useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, itemCount - 1)));
  }, [itemCount]);
  /* Selección múltiple (clasificar en lote): checkbox por fila (o Espacio en la
     fila activa) marca movimientos; se aplican todos con una misma categoría. */
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkAccountId, setBulkAccountId] = React.useState("");
  const [bulkCanonical, setBulkCanonical] = React.useState("");
  const [bulkRun, setBulkRun] = React.useState<{
    done: number;
    total: number;
    failed: number;
    running: boolean;
  } | null>(null);
  /* Descartar del set los ids que ya no están en la lista (se clasificaron). */
  React.useEffect(() => {
    const ids = new Set((movementsQuery.data?.items ?? []).map((m) => m.id));
    setChecked((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [movementsQuery.data]);
  /* Al cambiar de cuenta o de período, limpiar la selección del lote. */
  React.useEffect(() => {
    setChecked(new Set());
  }, [accountId, range]);
  /* Enfocar la lista cuando hay ítems y no hay drawer abierto → el teclado
     funciona de una (y vuelve a la lista al cerrar el drawer). */
  React.useEffect(() => {
    if (itemCount > 0 && !selected) listRef.current?.focus();
  }, [itemCount, selected]);
  /* Mantener la fila activa a la vista. */
  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  /* §18.7 — sugerencia capturada desde el banner; abre RuleFormDialog
     pre-poblado. read-only en el endpoint; persiste solo al confirmar el
     POST desde el dialog. */
  const [suggestionDraft, setSuggestionDraft] = React.useState<SuggestRuleResponse | null>(null);

  const canonicalOptions = React.useMemo(
    () => toCanonicalCategoryOptions(canonicalQuery.data?.items ?? []),
    [canonicalQuery.data],
  );
  const accountOptions = React.useMemo(
    () => flattenManagementAccounts(accountsQuery.data?.items ?? []),
    [accountsQuery.data],
  );
  /* Dimensiones activas+visibles con sus valores → secciones del drawer. Vacío
     cuando el flag está OFF (la sección de vistas queda oculta). */
  const classificationDimensions: ClassificationDimension[] = dims.data.map(
    ({ dimension, values }) => ({
      id: dimension.id,
      name: dimension.name,
      allowsMultiple: dimension.allows_multiple_values,
      values: toDimensionValueOptions(values),
    }),
  );

  if (movementsQuery.isLoading) return <LoadingSkeleton />;
  if (movementsQuery.isError)
    return <QavanteInlineError error={movementsQuery.error} what="los movimientos" />;

  const allMovements = movementsQuery.data?.items ?? [];
  /* Filtro por cuenta (no mezclar monedas) + moneda de cada movimiento para
     formatear correcto (US$ vs $). El vacío global (celebración) se evalúa sobre
     TODAS las cuentas; el filtro por cuenta solo afecta lo que se muestra. */
  const currencyMap = currencyByAccount(bankAccounts);
  const movements = allMovements.filter(passes);
  if (allMovements.length === 0) {
    return (
      <QavanteEmpty
        icon={CheckCircle2}
        title="¡Todo al día! 🎉"
        description="No te queda ningún movimiento por clasificar. Cuando lleguen nuevos que Qavante no pueda clasificar con confianza, aparecerán acá."
      />
    );
  }

  /* Abre el drawer para clasificar un movimiento (botón o Enter en la lista).
     Bloqueado si faltan las cuentas de gestión (no se puede clasificar). */
  function openFor(m: BankMovement) {
    if (accountsQuery.isError) return;
    setFormError(undefined);
    classify.reset();
    assign.reset();
    setSelected(m);
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allChecked = movements.length > 0 && movements.every((m) => checked.has(m.id));
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(movements.map((m) => m.id)));
  }

  /* Aplica UNA categoría a todos los seleccionados (secuencial, tolerante a
     errores puntuales). El hook invalida la lista tras cada uno → las filas
     desaparecen a medida que se clasifican. */
  async function runBulk() {
    const ids = [...checked];
    if (!bulkAccountId || ids.length === 0) return;
    setBulkRun({ done: 0, total: ids.length, failed: 0, running: true });
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        await classify.mutateAsync({
          movementId: ids[i]!,
          body: {
            management_account_id: bulkAccountId,
            canonical_category: (bulkCanonical || null) as
              | BankMovement["canonical_category"]
              | null,
            notes: null,
            create_rule: false,
          },
        });
      } catch {
        failed++;
      }
      setBulkRun({ done: i + 1, total: ids.length, failed, running: i + 1 < ids.length });
    }
    const ok = ids.length - failed;
    toast.success(`${ok} ${ok === 1 ? "movimiento clasificado" : "movimientos clasificados"}`, {
      description: failed > 0 ? `${failed} con error` : undefined,
    });
    setChecked(new Set());
    setBulkOpen(false);
    setBulkRun(null);
    setBulkAccountId("");
    setBulkCanonical("");
  }

  /* Triage por teclado: ↑↓ (o j/k) mueven la fila activa; Enter la clasifica.
     Solo cuando el drawer está cerrado (con el drawer abierto, las teclas son
     del formulario). */
  function onListKeyDown(e: React.KeyboardEvent) {
    if (selected) return;
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, movements.length - 1));
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = movements[active];
      if (m) openFor(m);
    } else if (e.key === " ") {
      // Espacio: marca/desmarca la fila activa para el lote.
      e.preventDefault();
      const m = movements[active];
      if (m) toggleCheck(m.id);
    }
  }

  function closeDrawer() {
    setSelected(null);
    setFormError(undefined);
    classify.reset();
    assign.reset();
  }

  async function submit(movement: BankMovement, draft: ClassificationDraft, createRule: boolean) {
    // Contrato real: management_account_id es obligatorio (422 sin él). El
    // `canSave` interno del drawer gatea por canonical (supuesto del
    // addendum, no del contrato) — guardamos defensivamente acá.
    if (!draft.managementAccountId) {
      setFormError("Elige una categoría de gestión para clasificar el movimiento.");
      return;
    }
    setFormError(undefined);
    assign.reset();
    try {
      await classify.mutateAsync({
        movementId: movement.id,
        body: {
          management_account_id: draft.managementAccountId,
          canonical_category:
            (draft.canonicalCategory as BankMovement["canonical_category"]) ?? null,
          notes: draft.notes || null,
          create_rule: createRule,
        },
      });
      /* D3: crear las asignaciones de dimensión seleccionadas. NO es atómico
         con classify (endpoints separados): si una asignación falla, el
         movimiento ya quedó clasificado y el error se muestra en el drawer (no
         se cierra). Con el flag OFF, dimensionAssignments es {} → no corre nada
         y el comportamiento es idéntico al previo. */
      const pairs = Object.entries(draft.dimensionAssignments).flatMap(([dimensionId, valueIds]) =>
        valueIds.map((valueId) => ({ dimensionId, valueId })),
      );
      for (const { dimensionId, valueId } of pairs) {
        await assign.mutateAsync({
          entity_type: "bank_movement",
          entity_id: movement.id,
          dimension_id: dimensionId,
          dimension_value_id: valueId,
        });
      }
      /* Feedback de éxito: antes la fila simplemente desaparecía de la lista, lo
         que se podía leer como error. El toast confirma la acción. */
      toast.success("Movimiento clasificado", {
        description: `${movement.description} · ${formatMoney(Math.abs(Number(movement.amount) || 0), currencyMap.get(movement.bank_account_id))}`,
      });
      setSelected(null);
      setFormError(undefined);
    } catch {
      /* El error (de classify o de una asignación) se renderiza dentro del
         drawer vía classify.error / assign.error. No se cierra para que el
         usuario reintente. */
    }
  }

  return (
    <div className="space-y-3">
      {/* Las cuentas de gestión son obligatorias para clasificar (422 sin
          management_account_id). Si su carga falla, sin esto el usuario veía un
          drawer sin cuentas + "Elige una categoría de gestión" engañoso, con el
          error tragado. La raíz suele ser el 500 de accounts/tree (backend). */}
      {accountsQuery.isError && (
        <QavanteInlineError
          error={accountsQuery.error}
          what="las cuentas de gestión — no vas a poder clasificar hasta resolverlo"
        />
      )}
      {/* Filtro de rango de período (idéntico al Libro) + selector de cuenta. */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <PeriodRangeFilter value={range} onChange={setRange} />
        {bankAccounts.length > 1 && (
          <BankAccountFilter
            accounts={bankAccounts}
            value={accountId}
            onChange={setAccountId}
            allowAll
          />
        )}
      </div>

      {movements.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-muted px-4 py-6 text-center text-sm text-neutral-mid">
          No hay movimientos por clasificar con los filtros aplicados.
        </p>
      ) : (
        <>
          {/* Toolbar: seleccionar todos + hint de teclado. */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-mid">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="h-4 w-4 accent-brand-primary"
                aria-label="Seleccionar todos los movimientos"
              />
              Seleccionar todos
            </label>
            <p className="text-xs text-neutral-mid">
              <kbd className="rounded border border-border bg-surface px-1 font-mono text-[11px]">
                ↑
              </kbd>{" "}
              <kbd className="rounded border border-border bg-surface px-1 font-mono text-[11px]">
                ↓
              </kbd>{" "}
              moverte ·{" "}
              <kbd className="rounded border border-border bg-surface px-1 font-mono text-[11px]">
                Enter
              </kbd>{" "}
              clasificar ·{" "}
              <kbd className="rounded border border-border bg-surface px-1 font-mono text-[11px]">
                Espacio
              </kbd>{" "}
              marcar
            </p>
          </div>

          {/* Barra de acción en lote (aparece con la selección). */}
          {checked.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-primary/30 bg-brand-primary-50 px-4 py-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-brand-deep">
                <ListChecks className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                {checked.size} seleccionado{checked.size === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <QavanteButton size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
                  Limpiar
                </QavanteButton>
                <QavanteButton
                  size="sm"
                  onClick={() => setBulkOpen(true)}
                  disabled={accountsQuery.isError}
                >
                  Clasificar {checked.size}
                </QavanteButton>
              </div>
            </div>
          )}
          <ul
            ref={listRef}
            role="listbox"
            aria-label="Movimientos por clasificar"
            aria-activedescendant={movements[active] ? `mov-${movements[active].id}` : undefined}
            tabIndex={0}
            onKeyDown={onListKeyDown}
            className="divide-y divide-border rounded-xl border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            {movements.map((m, idx) => {
              const isActive = idx === active;
              return (
                <li
                  key={m.id}
                  id={`mov-${m.id}`}
                  data-idx={idx}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActive(idx)}
                  className={cn(
                    "flex items-center gap-4 p-3 transition-colors",
                    checked.has(m.id)
                      ? "bg-brand-primary-50/60"
                      : isActive
                        ? "bg-brand-primary-50 ring-1 ring-inset ring-brand-primary/30"
                        : "hover:bg-surface-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(m.id)}
                    onChange={() => toggleCheck(m.id)}
                    className="h-4 w-4 shrink-0 accent-brand-primary"
                    aria-label={`Seleccionar ${m.description}`}
                  />
                  <span className="w-24 shrink-0 text-sm text-neutral-mid">
                    {m.date ? formatDateLike(m.date) : "—"}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-sm text-neutral-dark"
                    title={m.description}
                  >
                    {m.description}
                  </span>
                  <span
                    className={cn(
                      "w-36 shrink-0 text-right text-sm font-medium tabular-nums",
                      m.direction === "credit" ? "text-success-700" : "text-neutral-dark",
                    )}
                  >
                    {m.direction === "credit" ? "+" : "−"}{" "}
                    {formatMoney(
                      Math.abs(Number(m.amount) || 0),
                      currencyMap.get(m.bank_account_id),
                    )}
                  </span>
                  <QavanteButton
                    size="sm"
                    variant="secondary"
                    aria-label={`Clasificar movimiento ${m.description}`}
                    // Sin cuentas de gestión no se puede clasificar (422). Mejor
                    // bloquear que abrir un drawer inútil con el error tragado.
                    disabled={accountsQuery.isError}
                    onClick={() => openFor(m)}
                  >
                    Clasificar
                  </QavanteButton>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {selected && (
        <ClassificationDrawer
          key={selected.id}
          open
          onClose={closeDrawer}
          movement={movementSummary(selected, currencyMap.get(selected.bank_account_id))}
          lifecycle={[
            {
              status: "done",
              title: "Detectado en tu banco",
              children: `${selected.date ? formatDateLike(selected.date) : "—"} · Cuenta ····${selected.bank_account_id.slice(-4)}`,
            },
            {
              status: "current",
              title: "Por clasificar",
              children:
                "Qavante no lo clasificó con confianza. Elige la categoría de gestión abajo.",
            },
          ]}
          canonicalCategories={canonicalOptions}
          managementAccounts={accountOptions}
          dimensions={classificationDimensions}
          saving={classify.isPending || assign.isPending}
          onSave={(d) => submit(selected, d, false)}
          onSaveAndCreateRule={(d) => submit(selected, d, true)}
          onMarkForReview={() => {
            // El contrato actual no expone un endpoint de "marcar por
            // revisar" sin clasificar (classify exige management_account_id).
            // No se inventa (regla 16); se cierra. Reabrir si backend lo expone.
            closeDrawer();
          }}
          /* #4: el error va DENTRO del drawer (overlay z-50) o queda invisible
             debajo. formError (validación local) tiene prioridad sobre el de
             la mutación. */
          error={
            formError ? (
              <p role="alert" className="text-sm text-danger-500">
                {formError}
              </p>
            ) : classify.isError ? (
              <QavanteInlineError error={classify.error} what="al guardar la clasificación" />
            ) : assign.isError ? (
              <QavanteInlineError
                error={assign.error}
                what="al asignar las vistas de gestión (el movimiento ya quedó clasificado)"
              />
            ) : undefined
          }
          suggestionBanner={
            <SuggestRuleBanner
              movementId={selected.id}
              onCreateFromSuggestion={(s) => setSuggestionDraft(s)}
            />
          }
        />
      )}

      <RuleFormDialog
        open={suggestionDraft !== null}
        onOpenChange={(open) => {
          if (!open) setSuggestionDraft(null);
        }}
        rule={null}
        suggestion={suggestionDraft}
      />

      {/* Clasificar en lote: una misma categoría a todos los seleccionados. */}
      <Dialog.Root
        open={bulkOpen}
        onOpenChange={(o) => {
          if (!bulkRun?.running) setBulkOpen(o);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-brand-deep/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface p-5 shadow-xl data-[open]:animate-in data-[closed]:animate-out">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              Clasificar {checked.size} movimiento{checked.size === 1 ? "" : "s"}
            </Dialog.Title>
            <p className="mt-1 text-sm text-neutral-mid">
              Se aplica la misma categoría a todos los seleccionados.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-dark">Cuenta de gestión</span>
                <select
                  value={bulkAccountId}
                  onChange={(e) => setBulkAccountId(e.target.value)}
                  aria-label="Cuenta de gestión"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <option value="">Elige una cuenta…</option>
                  {accountOptions
                    .filter((o) => o.selectable)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {"  ".repeat(Math.max(0, o.level))}
                        {o.displayName}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-dark">
                  Categoría canónica{" "}
                  <span className="font-normal text-neutral-mid">(opcional)</span>
                </span>
                <select
                  value={bulkCanonical}
                  onChange={(e) => setBulkCanonical(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <option value="">Sin categoría canónica</option>
                  {canonicalOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {bulkRun?.running && (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-brand-primary-700">
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                Clasificando {bulkRun.done}/{bulkRun.total}…
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <QavanteButton
                size="sm"
                variant="ghost"
                disabled={Boolean(bulkRun?.running)}
                onClick={() => setBulkOpen(false)}
              >
                Cancelar
              </QavanteButton>
              <QavanteButton
                size="sm"
                onClick={runBulk}
                loading={Boolean(bulkRun?.running)}
                disabled={!bulkAccountId || Boolean(bulkRun?.running)}
              >
                Clasificar {checked.size}
              </QavanteButton>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
