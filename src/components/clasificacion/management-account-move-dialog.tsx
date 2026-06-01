"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useMoveManagementAccount } from "@/lib/api/management";
import type { ManagementAccountTreeRow } from "./types";

/* Mover cuenta de gestión (addendum §14, POST /move owner/admin). SIN
   drag-and-drop (ADR-0009): selector explícito "Mover a…". El nuevo padre se
   elige de `targets` (el container ya excluyó la propia cuenta + sus
   descendientes para evitar ciclos). Body `{new_parent_id: string|null}` —
   null = raíz. Si aun así el backend detecta un ciclo (422, p. ej. por edición
   concurrente), se muestra el copy específico. Lazy desde el container. */

export interface ManagementAccountMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuenta a mover. null cuando el diálogo está cerrado. */
  account: ManagementAccountTreeRow | null;
  /** Destinos válidos (sin la propia cuenta ni sus descendientes). */
  targets: ManagementAccountTreeRow[];
}

const CYCLE_MESSAGE = "No se puede mover ahí porque generaría una relación circular.";

const selectClass = cn(
  "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
);

export function ManagementAccountMoveDialog({
  open,
  onOpenChange,
  account,
  targets,
}: ManagementAccountMoveDialogProps) {
  const move = useMoveManagementAccount();
  const [parentId, setParentId] = React.useState<string>("");
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  /* Pre-selecciona el padre actual al abrir o cambiar de cuenta. */
  React.useEffect(() => {
    if (open && account) {
      setParentId(account.parentId ?? "");
      setSubmitError(null);
    }
  }, [open, account]);

  const unchanged = account ? (account.parentId ?? "") === parentId : true;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setSubmitError(null);
    try {
      await move.mutateAsync({
        accountId: account.id,
        body: { new_parent_id: parentId || null },
      });
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
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              Mover cuenta
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            {account ? (
              <>
                Elige el nuevo padre de{" "}
                <span className="font-medium text-neutral-dark">{account.name}</span>{" "}
                <span className="font-mono text-xs">({account.code})</span>. No puedes moverla
                dentro de sí misma ni de sus sub-cuentas.
              </>
            ) : (
              ""
            )}
          </Dialog.Description>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="move-parent" className="text-sm font-medium text-neutral-dark">
                Mover a
              </label>
              <select
                id="move-parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className={selectClass}
              >
                <option value="">Raíz (sin padre)</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {" ".repeat(t.level * 2)}
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
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
