"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { QavanteEmpty, QavanteButton, QavanteInlineError } from "@/components/qavante";
import { cn } from "@/lib/utils";
import {
  useBankMovements,
  useClassifyBankMovement,
  useCanonicalCategories,
  type BankMovement,
} from "@/lib/api/treasury";
import {
  useManagementAccountsTree,
  useClassificationDimensions,
  useCreateDimensionAssignment,
} from "@/lib/api/management";
import type { SuggestRuleResponse } from "@/lib/api/classification-rules";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
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

function movementSummary(m: BankMovement) {
  return {
    date: m.date ? formatDate(new Date(m.date)) : "—",
    description: m.description,
    // §17.1: no mostrar número de cuenta completo.
    bankLabel: `Cuenta ····${m.bank_account_id.slice(-4)}`,
    amountFormatted: formatClp(Number(m.amount) || 0),
  };
}

export interface PorClasificarViewProps {
  /** Flag `managementDimensions`. OFF ⇒ no se fetchean dimensiones ni se
   *  muestran/crean asignaciones (default, comportamiento previo). */
  dimensionsEnabled?: boolean;
}

export function PorClasificarView({ dimensionsEnabled = false }: PorClasificarViewProps = {}) {
  const movementsQuery = useBankMovements({ status: "unclassified" });
  const canonicalQuery = useCanonicalCategories();
  const accountsQuery = useManagementAccountsTree();
  const classify = useClassifyBankMovement();
  const dims = useClassificationDimensions(dimensionsEnabled);
  const assign = useCreateDimensionAssignment();

  const [selected, setSelected] = React.useState<BankMovement | null>(null);
  const [formError, setFormError] = React.useState<string>();
  /* Triage por teclado (nivel dios): ↑↓ mueven la fila activa, Enter abre el
     drawer para clasificarla. `active` indexa `movements`; se acota cuando la
     lista cambia (al clasificar, la fila desaparece). */
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const itemCount = movementsQuery.data?.items?.length ?? 0;
  React.useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, itemCount - 1)));
  }, [itemCount]);
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

  const movements = movementsQuery.data?.items ?? [];
  if (movements.length === 0) {
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
        description: `${movement.description} · ${formatClp(Math.abs(Number(movement.amount) || 0))}`,
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
      {/* Triage por teclado (nivel dios). */}
      <p className="px-1 text-xs text-neutral-mid">
        Consejo: usa{" "}
        <kbd className="rounded border border-border bg-surface px-1 font-mono text-[11px]">↑</kbd>{" "}
        <kbd className="rounded border border-border bg-surface px-1 font-mono text-[11px]">↓</kbd>{" "}
        para moverte y{" "}
        <kbd className="rounded border border-border bg-surface px-1 font-mono text-[11px]">
          Enter
        </kbd>{" "}
        para clasificar.
      </p>
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
                isActive
                  ? "bg-brand-primary-50 ring-1 ring-inset ring-brand-primary/30"
                  : "hover:bg-surface-muted",
              )}
            >
              <span className="w-24 shrink-0 text-sm text-neutral-mid">
                {m.date ? formatDate(new Date(m.date)) : "—"}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-sm text-neutral-dark"
                title={m.description}
              >
                {m.description}
              </span>
              <span className="w-32 shrink-0 text-right text-sm font-medium text-neutral-dark">
                {formatClp(Number(m.amount) || 0)}
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

      {selected && (
        <ClassificationDrawer
          key={selected.id}
          open
          onClose={closeDrawer}
          movement={movementSummary(selected)}
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
    </div>
  );
}
