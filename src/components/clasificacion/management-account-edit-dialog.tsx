"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useUpdateManagementAccount } from "@/lib/api/management";
import {
  accountEditFormSchema,
  accountToEditForm,
  formToUpdateRequest,
  type AccountEditFormValues,
} from "./management-account-form-schema";
import type { ManagementAccountTreeRow } from "./types";

/* Editar cuenta de gestión (addendum §14, PATCH owner/admin). Solo nombre,
   glosa y afecta-Pulso (code/type/destination/parent no son mutables vía PATCH;
   mover usa endpoint dedicado — PR siguiente). Base UI Dialog + react-hook-form
   + zod (mismo patrón que el dialog de creación). Lazy desde el container.
   404 (borrada en otra pestaña) / 403 (sin permiso, §20) → apiErrorToUserMessage. */

export interface ManagementAccountEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuenta a editar. null cuando el diálogo está cerrado. */
  account: ManagementAccountTreeRow | null;
}

const textareaClass = cn(
  "flex w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
);

const EMPTY_EDIT: AccountEditFormValues = {
  name: "",
  displayName: "",
  description: "",
  affectsPulso: true,
};

export function ManagementAccountEditDialog({
  open,
  onOpenChange,
  account,
}: ManagementAccountEditDialogProps) {
  const update = useUpdateManagementAccount();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountEditFormValues>({
    resolver: zodResolver(accountEditFormSchema),
    defaultValues: EMPTY_EDIT,
    mode: "onBlur",
  });

  /* Re-sincroniza al abrir o cambiar de cuenta editada. */
  React.useEffect(() => {
    if (open && account) {
      reset(accountToEditForm(account));
      setSubmitError(null);
    }
  }, [open, account, reset]);

  async function onSubmit(values: AccountEditFormValues) {
    if (!account) return;
    setSubmitError(null);
    try {
      await update.mutateAsync({ accountId: account.id, body: formToUpdateRequest(values) });
      onOpenChange(false);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? apiErrorToUserMessage(err) : "Error inesperado. Reintenta.",
      );
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              Editar cuenta
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
                <span className="font-mono text-xs">{account.code}</span> — cambia el nombre, la
                glosa o si afecta el Pulso. El código, el tipo y la ubicación se ajustan por otras
                acciones.
              </>
            ) : (
              ""
            )}
          </Dialog.Description>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="acct-edit-name" className="text-sm font-medium text-neutral-dark">
                Nombre
              </label>
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <QavanteInput
                    id="acct-edit-name"
                    placeholder="Ej: Ventas"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={Boolean(errors.name)}
                    aria-required="true"
                    aria-describedby={errors.name ? "acct-edit-name-error" : undefined}
                  />
                )}
              />
              {errors.name && (
                <p id="acct-edit-name-error" className="text-xs text-danger-500" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="acct-edit-display-name"
                className="text-sm font-medium text-neutral-dark"
              >
                Nombre para mostrar <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="displayName"
                render={({ field }) => (
                  <QavanteInput
                    id="acct-edit-display-name"
                    placeholder="Si lo dejas vacío, se muestra el nombre"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="acct-edit-description"
                className="text-sm font-medium text-neutral-dark"
              >
                Descripción <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <textarea
                    id="acct-edit-description"
                    rows={2}
                    placeholder="Para qué se usa esta cuenta"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    className={textareaClass}
                  />
                )}
              />
            </div>

            <Controller
              control={control}
              name="affectsPulso"
              render={({ field }) => (
                <label className="flex items-start gap-2 text-sm text-neutral-dark">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-light text-brand-primary"
                  />
                  <span>
                    Afecta el Pulso
                    <span className="block text-xs text-neutral-mid">
                      Cuenta los movimientos de esta cuenta al calcular el Pulso del negocio.
                    </span>
                  </span>
                </label>
              )}
            />

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
              <QavanteButton type="submit" loading={isSubmitting}>
                Guardar cambios
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
