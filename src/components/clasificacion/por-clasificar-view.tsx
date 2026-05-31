"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { QavanteEmpty, QavanteButton, QavanteInlineError } from "@/components/qavante";
import {
  useBankMovements,
  useClassifyBankMovement,
  useCanonicalCategories,
  type BankMovement,
} from "@/lib/api/treasury";
import { useManagementAccountsTree } from "@/lib/api/management";
import type { SuggestRuleResponse } from "@/lib/api/classification-rules";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
import { ClassificationDrawer } from "./classification-drawer";
import { SuggestRuleBanner } from "./suggest-rule-banner";
import { flattenManagementAccounts, toCanonicalCategoryOptions } from "./adapters";

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
   `management_account_id` es OBLIGATORIO (422 sin él); NO hay
   `dimension_assignments` (asignar dimensión = endpoint aparte) → el drawer
   va con `dimensions={[]}` (esa sección queda oculta). §17.4: el resumen del
   movimiento es read-only (no se edita glosa/fecha/monto). */

function LoadingSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-neutral-light/30" />
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

export function PorClasificarView() {
  const movementsQuery = useBankMovements({ status: "unclassified" });
  const canonicalQuery = useCanonicalCategories();
  const accountsQuery = useManagementAccountsTree();
  const classify = useClassifyBankMovement();

  const [selected, setSelected] = React.useState<BankMovement | null>(null);
  const [formError, setFormError] = React.useState<string>();
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

  if (movementsQuery.isLoading) return <LoadingSkeleton />;
  if (movementsQuery.isError)
    return <QavanteInlineError error={movementsQuery.error} what="los movimientos" />;

  const movements = movementsQuery.data?.items ?? [];
  if (movements.length === 0) {
    return (
      <QavanteEmpty
        title="No hay movimientos por clasificar"
        description="Cuando Qavante reciba movimientos que no pueda clasificar con confianza, vas a poder revisarlos acá."
      />
    );
  }

  function submit(
    movement: BankMovement,
    draft: { canonicalCategory?: string; managementAccountId?: string; notes: string },
    createRule: boolean,
  ) {
    // Contrato real: management_account_id es obligatorio (422 sin él). El
    // `canSave` interno del drawer gatea por canonical (supuesto del
    // addendum, no del contrato) — guardamos defensivamente acá.
    if (!draft.managementAccountId) {
      setFormError("Elige una categoría de gestión para clasificar el movimiento.");
      return;
    }
    setFormError(undefined);
    classify.mutate(
      {
        movementId: movement.id,
        body: {
          management_account_id: draft.managementAccountId,
          canonical_category:
            (draft.canonicalCategory as BankMovement["canonical_category"]) ?? null,
          notes: draft.notes || null,
          create_rule: createRule,
        },
      },
      {
        onSuccess: () => {
          setSelected(null);
          setFormError(undefined);
        },
      },
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-neutral-light rounded-md border border-neutral-light">
        {movements.map((m) => (
          <li key={m.id} className="flex items-center gap-4 p-3">
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
              onClick={() => {
                setFormError(undefined);
                setSelected(m);
              }}
            >
              Clasificar
            </QavanteButton>
          </li>
        ))}
      </ul>

      {selected && (
        <ClassificationDrawer
          key={selected.id}
          open
          onClose={() => setSelected(null)}
          movement={movementSummary(selected)}
          canonicalCategories={canonicalOptions}
          managementAccounts={accountOptions}
          dimensions={[]}
          saving={classify.isPending}
          onSave={(d) => submit(selected, d, false)}
          onSaveAndCreateRule={(d) => submit(selected, d, true)}
          onMarkForReview={() => {
            // El contrato actual no expone un endpoint de "marcar por
            // revisar" sin clasificar (classify exige management_account_id).
            // No se inventa (regla 16); se cierra. Reabrir si backend lo expone.
            setSelected(null);
          }}
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

      {formError && (
        <p role="alert" className="text-sm text-danger-500">
          {formError}
        </p>
      )}
      {classify.isError && (
        <QavanteInlineError error={classify.error} what="al guardar la clasificación" />
      )}
    </div>
  );
}
