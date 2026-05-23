"use client";

import * as React from "react";
import { X } from "lucide-react";
import { QavanteButton, QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { CanonicalCategorySelect } from "./canonical-category-select";
import { ManagementAccountSelect } from "./management-account-select";
import { DimensionValuePicker } from "./dimension-value-picker";
import type {
  CanonicalCategoryOption,
  DimensionValueOption,
  ManagementAccountOption,
} from "./types";

/* Shell del drawer de clasificación (addendum §17.2). PRESENTACIONAL PURO:
   compone los 3 selectores, mantiene SOLO estado de formulario local (UI), y
   emite el payload por callbacks. Sin fetch, sin mutación, sin tipos
   generados. El request real (§17.3 POST .../classify) lo arma el PR de
   integración. Reglas críticas §17.4 (no editar glosa/fecha/monto, no
   mostrar IDs técnicos) se respetan: el resumen es read-only y formateado
   por quien llama (el FE no calcula finanzas — addendum §16.3). */

export interface ClassificationMovementSummary {
  date: string;
  description: string;
  bankLabel: string;
  amountFormatted: string;
}

export interface ClassificationDimension {
  id: string;
  name: string;
  allowsMultiple: boolean;
  values: DimensionValueOption[];
}

export interface ClassificationDraft {
  canonicalCategory?: string;
  managementAccountId?: string;
  dimensionAssignments: Record<string, string[]>;
  notes: string;
}

export interface ClassificationDrawerProps {
  open: boolean;
  onClose: () => void;
  movement: ClassificationMovementSummary;
  canonicalCategories: CanonicalCategoryOption[];
  managementAccounts: ManagementAccountOption[];
  dimensions?: ClassificationDimension[];
  onSave: (draft: ClassificationDraft) => void;
  onSaveAndCreateRule: (draft: ClassificationDraft) => void;
  onMarkForReview: () => void;
  saving?: boolean;
  /** Slot opcional para el banner §18.7 (sugerencia de regla). Se renderiza
   *  arriba de los selectores. PRESENTACIONAL PURO: el drawer no sabe nada
   *  del estado del banner — el contenedor lo monta con sus hooks. */
  suggestionBanner?: React.ReactNode;
}

export function ClassificationDrawer({
  open,
  onClose,
  movement,
  canonicalCategories,
  managementAccounts,
  dimensions = [],
  onSave,
  onSaveAndCreateRule,
  onMarkForReview,
  saving,
  suggestionBanner,
}: ClassificationDrawerProps) {
  const [draft, setDraft] = React.useState<ClassificationDraft>({
    dimensionAssignments: {},
    notes: "",
  });
  const titleId = React.useId();
  const asideRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!open) return;
    // Foco al abrir; restaurar al cerrar (requisito WCAG de diálogo modal).
    const prevFocused = document.activeElement as HTMLElement | null;
    asideRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  /* Contrato real (regla 16, addendum §17.3 erróneo): `management_account_id`
     es OBLIGATORIO (422 sin él); `canonical_category` es opcional/nullable.
     `notes` y `create_rule` también opcionales. */
  const canSave = Boolean(draft.managementAccountId) && !saving;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-neutral-dark/40" aria-hidden="true" onClick={onClose} />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface shadow-xl focus-visible:outline-none"
      >
        <header className="flex items-start justify-between border-b border-neutral-light p-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-neutral-dark">
              Clasificar movimiento
            </h2>
            <p className="mt-0.5 text-xs text-neutral-mid">
              Qavante no modifica el movimiento original del banco. Solo agrega una clasificación de
              gestión.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-neutral-mid hover:bg-brand-primary-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 p-4">
          <QavanteCard variant="bordered">
            <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
              <dt className="text-neutral-mid">Fecha</dt>
              <dd className="col-span-2 text-neutral-dark">{movement.date}</dd>
              <dt className="text-neutral-mid">Glosa</dt>
              <dd className="col-span-2 text-neutral-dark">{movement.description}</dd>
              <dt className="text-neutral-mid">Banco</dt>
              <dd className="col-span-2 text-neutral-dark">{movement.bankLabel}</dd>
              <dt className="text-neutral-mid">Monto</dt>
              <dd className="col-span-2 font-medium text-neutral-dark">
                {movement.amountFormatted}
              </dd>
            </dl>
          </QavanteCard>

          {suggestionBanner}

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-neutral-dark">Tipo de movimiento</h3>
            <CanonicalCategorySelect
              items={canonicalCategories}
              value={draft.canonicalCategory}
              onChange={(code) => setDraft((d) => ({ ...d, canonicalCategory: code }))}
              disabled={saving}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-neutral-dark">Categoría de gestión</h3>
            <ManagementAccountSelect
              items={managementAccounts}
              value={draft.managementAccountId}
              onChange={(id) => setDraft((d) => ({ ...d, managementAccountId: id }))}
              disabled={saving}
            />
          </section>

          {dimensions.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-neutral-dark">Vistas de gestión</h3>
              {dimensions.map((dim) => (
                <DimensionValuePicker
                  key={dim.id}
                  dimensionName={dim.name}
                  values={dim.values}
                  allowsMultiple={dim.allowsMultiple}
                  selected={draft.dimensionAssignments[dim.id] ?? []}
                  onChange={(ids) =>
                    setDraft((d) => ({
                      ...d,
                      dimensionAssignments: { ...d.dimensionAssignments, [dim.id]: ids },
                    }))
                  }
                  disabled={saving}
                />
              ))}
            </section>
          )}

          <section className="space-y-2">
            <label htmlFor={`${titleId}-notes`} className="text-sm font-medium text-neutral-dark">
              Notas
            </label>
            <textarea
              id={`${titleId}-notes`}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              disabled={saving}
              rows={3}
              className={cn(
                "w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
          </section>
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-neutral-light p-4">
          <QavanteButton
            variant="primary"
            size="sm"
            disabled={!canSave}
            onClick={() => onSave(draft)}
          >
            Guardar
          </QavanteButton>
          <QavanteButton
            variant="secondary"
            size="sm"
            disabled={!canSave}
            onClick={() => onSaveAndCreateRule(draft)}
          >
            Guardar y crear regla
          </QavanteButton>
          <QavanteButton variant="ghost" size="sm" disabled={saving} onClick={onMarkForReview}>
            Marcar por revisar
          </QavanteButton>
          <QavanteButton variant="ghost" size="sm" disabled={saving} onClick={onClose}>
            Cancelar
          </QavanteButton>
        </footer>
      </aside>
    </div>
  );
}
