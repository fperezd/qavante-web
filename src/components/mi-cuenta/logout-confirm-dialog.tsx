"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { LogOut, X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mensaje de error a mostrar tras un fallo de la mutación de logout. */
  error?: string | null;
  loading?: boolean;
  onConfirm: () => void;
}

/* Confirmación de cierre de sesión. A diferencia de `DeleteConfirmDialog`,
   logout NO es destructivo: sin triángulo de warning ni botón danger.
   Icono neutro + botón primary. Evita el logout accidental (pierdes tu
   lugar y tienes que volver a autenticarte). */
export function LogoutConfirmDialog({
  open,
  onOpenChange,
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
              <LogOut className="h-5 w-5 text-brand-primary" aria-hidden="true" />
              ¿Cerrar sesión?
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            Vas a volver a la pantalla de inicio de sesión. Vas a tener que ingresar tus
            credenciales de nuevo para entrar.
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
            <QavanteButton type="button" variant="primary" loading={loading} onClick={onConfirm}>
              Cerrar sesión
            </QavanteButton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
