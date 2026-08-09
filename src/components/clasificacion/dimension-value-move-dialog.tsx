"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useMoveDimensionValue } from "@/lib/api/management";
import type { DimensionValueTreeRow } from "./types";

/* Mover un valor dentro de su dimensión (addendum §15.5, POST /move). SIN
   drag-and-drop (ADR-0009): selector "Mover a…". `targets` ya excluye el
   propio valor + sus descendientes. Body `{new_parent_id: string|null}` —
   null = raíz. 422 (ciclo) → copy específico. Lazy desde el drawer. */

export interface DimensionValueMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: DimensionValueTreeRow | null;
  targets: DimensionValueTreeRow[];
}

const CYCLE_MESSAGE = "No se puede mover ahí porque generaría una relación circular.";

const selectClass = cn(
  "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
);

export function DimensionValueMoveDialog({
  open,
  onOpenChange,
  value,
  targets,
}: DimensionValueMoveDialogProps) {
  const move = useMoveDimensionValue();
  const [parentId, setParentId] = React.useState<string>("");
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && value) {
      setParentId(value.parentId ?? "");
      setSubmitError(null);
    }
  }, [open, value]);

  const unchanged = value ? (value.parentId ?? "") === parentId : true;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setSubmitError(null);
    try {
      await move.mutateAsync({ valueId: value.id, body: { new_parent_id: parentId || null } });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.isValidation() ? CYCLE_MESSAGE : apiErrorToUserMessage(err));
      } else {
        setSubmitError("Error inesperado. Reintenta.");
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-neutral-dark/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[70] max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              Mover valor
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            {value ? (
              <>
                Elige el nuevo padre de{" "}
                <span className="font-medium text-neutral-dark">{value.name}</span>. No puede ser él
                mismo ni uno de sus sub-valores.
              </>
            ) : (
              ""
            )}
          </Dialog.Description>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="val-move-parent" className="text-sm font-medium text-neutral-dark">
                Mover a
              </label>
              <select
                id="val-move-parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className={selectClass}
              >
                <option value="">Raíz (sin padre)</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {" ".repeat(t.level * 2)}
                    {t.code ? `${t.code} · ` : ""}
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
              >
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close render={<QavanteButton variant="ghost" type="button" />}>
                Cancelar
              </Dialog.Close>
              <QavanteButton type="submit" loading={move.isPending} disabled={unchanged}>
                Mover
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
