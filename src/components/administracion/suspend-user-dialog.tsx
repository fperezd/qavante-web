"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { useUpdateUser, type User } from "@/lib/api/users";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";

interface SuspendUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuspendUserDialog({ user, open, onOpenChange }: SuspendUserDialogProps) {
  const update = useUpdateUser();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  if (!user) return null;

  const target: "active" | "suspended" = user.status === "suspended" ? "active" : "suspended";
  const isReactivating = target === "active";
  // Un invitado (aún no aceptó) no tiene sesión que cerrar: la acción es CANCELAR la invitación
  // (el backend solo ofrece status active/suspended → suspenderlo la revoca). Copy honesta aparte.
  const isInvited = user.status === "invited";

  async function onConfirm() {
    if (!user) return;
    setError(null);
    try {
      await update.mutateAsync({ id: user.id, body: { status: target } });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "last_owner_protection") {
          setError("No puedes suspender al último dueño de la empresa.");
        } else {
          setError(apiErrorToUserMessage(err));
        }
      } else {
        setError("Error inesperado. Reintenta.");
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-neutral-dark">
              {!isReactivating && <AlertTriangle className="h-5 w-5 text-warning-500" />}
              {isReactivating ? "Reactivar usuario" : isInvited ? "Cancelar invitación" : "Suspender usuario"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            {isReactivating ? (
              <>
                <strong>{user.name ?? user.email}</strong> va a poder volver a iniciar sesión y
                acceder según su rol ({user.role}).
              </>
            ) : isInvited ? (
              <>
                <strong>{user.name ?? user.email}</strong> ya no va a poder aceptar la invitación ni
                acceder a la empresa.
              </>
            ) : (
              <>
                <strong>{user.name ?? user.email}</strong> no va a poder iniciar sesión. Su sesión
                actual se cierra automáticamente. Puedes reactivarlo después.
              </>
            )}
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
            <QavanteButton
              type="button"
              variant={isReactivating ? "primary" : "danger"}
              loading={update.isPending}
              onClick={onConfirm}
            >
              {isReactivating ? "Reactivar" : isInvited ? "Cancelar invitación" : "Suspender"}
            </QavanteButton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
