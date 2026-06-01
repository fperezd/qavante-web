"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Plus, X } from "lucide-react";
import { QavanteButton, QavanteEmpty } from "@/components/qavante";
import { useDimensionValues, useUpdateDimensionValue } from "@/lib/api/management";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { DimensionValuesTree } from "./dimension-values-tree";
import { toDimensionValueTreeRows, excludeSelfAndDescendants } from "./adapters";
import type { DimensionValueTreeRow } from "./types";

/* Editor del ÁRBOL de valores de una dimensión (addendum §15.5). Drawer
   overlay (como el de clasificación). Container: resuelve los valores +
   mutaciones (crear/editar/mover/activar) y monta el árbol. Los diálogos son
   lazy y se portalean por encima del drawer (z-[60]+). El backend impone el
   permiso (403 → Anexo C.3). */

const DimensionValueFormDialog = dynamic(
  () =>
    import("./dimension-value-form-dialog").then((m) => ({ default: m.DimensionValueFormDialog })),
  { ssr: false },
);
const DimensionValueMoveDialog = dynamic(
  () =>
    import("./dimension-value-move-dialog").then((m) => ({ default: m.DimensionValueMoveDialog })),
  { ssr: false },
);

export interface DimensionValuesDrawerProps {
  /** Dimensión cuyos valores se editan. null = cerrado. */
  dimension: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DimensionValuesDrawer({
  dimension,
  open,
  onOpenChange,
}: DimensionValuesDrawerProps) {
  const dimensionId = dimension?.id ?? "";
  const valuesQuery = useDimensionValues(dimensionId);
  const toggleActive = useUpdateDimensionValue();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingValue, setEditingValue] = React.useState<DimensionValueTreeRow | null>(null);
  const [createParent, setCreateParent] = React.useState<{ id: string; name: string } | null>(null);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [moveValue, setMoveValue] = React.useState<DimensionValueTreeRow | null>(null);

  const asideRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const prevFocused = document.activeElement as HTMLElement | null;
    asideRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocused?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open || !dimension) return null;

  const rows = toDimensionValueTreeRows(valuesQuery.data?.items ?? []);
  const pendingId = toggleActive.isPending ? toggleActive.variables?.valueId : null;
  const mutationError = toggleActive.error;
  const moveTargets = moveValue ? excludeSelfAndDescendants(rows, moveValue.id) : [];

  function openCreateRoot() {
    setEditingValue(null);
    setCreateParent(null);
    setFormOpen(true);
  }
  function openCreateChild(row: DimensionValueTreeRow) {
    setEditingValue(null);
    setCreateParent({ id: row.id, name: row.name });
    setFormOpen(true);
  }
  function openEdit(row: DimensionValueTreeRow) {
    setCreateParent(null);
    setEditingValue(row);
    setFormOpen(true);
  }
  function openMove(row: DimensionValueTreeRow) {
    setMoveValue(row);
    setMoveOpen(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-neutral-dark/40"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Valores de ${dimension.name}`}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface shadow-xl focus-visible:outline-none"
      >
        <header className="flex items-start justify-between border-b border-neutral-light p-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-dark">Valores de {dimension.name}</h2>
            <p className="mt-0.5 text-xs text-neutral-mid">
              Crea, edita, mueve y activa/desactiva los valores de esta vista.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className="rounded-md p-1 text-neutral-mid hover:bg-brand-primary-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-3 p-4">
          <div className="flex justify-end">
            <QavanteButton size="sm" onClick={openCreateRoot}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo valor
            </QavanteButton>
          </div>

          {mutationError && (
            <div
              role="alert"
              className="rounded-md border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
            >
              {mutationError instanceof ApiError
                ? apiErrorToUserMessage(mutationError)
                : "No pudimos guardar el cambio. Intenta nuevamente."}
            </div>
          )}

          {valuesQuery.isLoading ? (
            <div className="space-y-2" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-neutral-light/30" />
              ))}
            </div>
          ) : valuesQuery.isError ? (
            <div
              role="alert"
              className="rounded-md border border-danger-500/30 bg-danger-500/5 p-3 text-sm text-neutral-dark"
            >
              {valuesQuery.error instanceof ApiError
                ? apiErrorToUserMessage(valuesQuery.error)
                : "No pudimos cargar los valores. Intenta nuevamente."}
            </div>
          ) : rows.length === 0 ? (
            <QavanteEmpty
              title="Esta vista todavía no tiene valores"
              description="Crea el primero con «Nuevo valor» (por ejemplo, una obra, un cliente o un local)."
            />
          ) : (
            <DimensionValuesTree
              rows={rows}
              pendingId={pendingId}
              onCreateChild={openCreateChild}
              onEdit={openEdit}
              onMove={openMove}
              onToggleActive={(row) =>
                toggleActive.mutate({ valueId: row.id, body: { active: !row.active } })
              }
            />
          )}
        </div>
      </aside>

      <DimensionValueFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        dimensionId={dimension.id}
        value={editingValue}
        parent={createParent}
      />
      <DimensionValueMoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        value={moveValue}
        targets={moveTargets}
      />
    </div>
  );
}
