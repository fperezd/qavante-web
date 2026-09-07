"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, X } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";

interface OpeningCutoffConfirmDialogProps {
  action: "apply" | "revert";
  cutoffDate?: string;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function OpeningCutoffConfirmDialog({
  action,
  cutoffDate,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: OpeningCutoffConfirmDialogProps) {
  const [confirmation, setConfirmation] = React.useState("");
  const isApply = action === "apply";
  const phrase = isApply ? "APLICAR CORTE" : "DESHACER CORTE";

  React.useEffect(() => {
    if (!open) setConfirmation("");
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-neutral-dark">
              <AlertTriangle className="h-5 w-5 text-warning-500" aria-hidden="true" />
              {isApply ? "Aplicar corte de apertura" : "Deshacer corte de apertura"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="mb-4 space-y-2 text-sm text-neutral-mid">
            {isApply ? (
              <>
                <span className="block">
                  El historial hasta el <strong>{cutoffDate}</strong> saldrá de las colas diarias de
                  esta empresa.
                </span>
                <span className="block">
                  No se inventarán categorías ni cruces bancarios: quedará registrado como saldo de
                  apertura y podrás deshacerlo.
                </span>
              </>
            ) : (
              <span className="block">
                Los documentos y movimientos retirados por este corte volverán a sus estados
                pendientes anteriores. No se tocarán conciliaciones reales posteriores.
              </span>
            )}
          </Dialog.Description>

          <label className="mb-5 block text-sm font-medium text-neutral-dark">
            Escribe <strong>{phrase}</strong> para confirmar
            <QavanteInput
              className="mt-2"
              value={confirmation}
              onValueChange={setConfirmation}
              autoComplete="off"
              aria-label={`Escribe ${phrase} para confirmar`}
            />
          </label>

          <div className="flex justify-end gap-2">
            <Dialog.Close render={<QavanteButton variant="ghost" type="button" />}>
              Cancelar
            </Dialog.Close>
            <QavanteButton
              type="button"
              variant={isApply ? "primary" : "danger"}
              loading={pending}
              disabled={confirmation.trim().toUpperCase() !== phrase}
              onClick={onConfirm}
            >
              {isApply ? "Aplicar corte" : "Deshacer corte"}
            </QavanteButton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
