"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useBankMovements,
  useClassifyBankMovement,
  useCanonicalCategories,
  type BankMovement,
} from "@/lib/api/treasury";
import { useManagementAccountsTree } from "@/lib/api/management";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
import { ClassificationDrawer } from "./classification-drawer";
import { flattenManagementAccounts, toCanonicalCategoryOptions } from "./adapters";

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

function ErrorState({ error, what }: { error: unknown; what: string }) {
  const message =
    error instanceof ApiError ? apiErrorToUserMessage(error) : `No pudimos cargar ${what}.`;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function movementSummary(m: BankMovement) {
  return {
    date: m.date ? formatDate(new Date(m.date)) : "—",
    description: m.description,
    // §17.1: no mostrar número de cuenta completo.
    bankLabel: `Cuenta ····${m.bank_account_id.slice(-4)}`,
    amountFormatted: formatClp(Number(m.amount)),
  };
}

export function PorClasificarView() {
  const movementsQuery = useBankMovements({ status: "unclassified" });
  const canonicalQuery = useCanonicalCategories();
  const accountsQuery = useManagementAccountsTree();
  const classify = useClassifyBankMovement();

  const [selected, setSelected] = React.useState<BankMovement | null>(null);
  const [formError, setFormError] = React.useState<string>();

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
    return <ErrorState error={movementsQuery.error} what="los movimientos" />;

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
      setFormError("Elegí una categoría de gestión para clasificar el movimiento.");
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
              {formatClp(Number(m.amount))}
            </span>
            <QavanteButton
              size="sm"
              variant="secondary"
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
        />
      )}

      {formError && (
        <p role="alert" className="text-sm text-danger-500">
          {formError}
        </p>
      )}
      {classify.isError && <ErrorState error={classify.error} what="al guardar la clasificación" />}
    </div>
  );
}
