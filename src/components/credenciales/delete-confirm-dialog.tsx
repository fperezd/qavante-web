"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  /** Mensaje de error a mostrar tras un fallo de la mutación. */
  error?: string | null;
  loading?: boolean;
  onConfirm: () => void;
}

/* Dialog destructivo reusable. Convenios Anexo F:
   - Icono de warning en el title.
   - Botón Cancelar (ghost) + botón confirm (danger).
   - Descripción explícita del efecto. */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Eliminar",
  error,
  loading = false,
  onConfirm,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-neutral-dark">
              <AlertTriangle className="h-5 w-5 text-warning-500" />
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            {description}
          </Dialog.Description>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Dialog.Close render={<QavanteButton variant="ghost" type="button" />}>
              Cancelar
            </Dialog.Close>
            <QavanteButton type="button" variant="danger" loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </QavanteButton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
