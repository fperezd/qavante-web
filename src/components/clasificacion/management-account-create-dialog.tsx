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
import { useCreateManagementAccount } from "@/lib/api/management";
import {
  accountFormSchema,
  emptyAccountForm,
  formToCreateRequest,
  humanizeDomain,
  type AccountFormValues,
} from "./management-account-form-schema";

/* Crear cuenta de gestión (addendum §14, POST owner/admin). Base UI Dialog +
   react-hook-form + zod (mismo patrón que rule-form-dialog). Lazy-loaded desde
   el container (admin-only). Schema + transforms en management-account-form-
   schema (sin React, testeable). El backend re-valida: 409 code duplicado,
   422 dominio inválido, 403 sin permiso (§20) — vía apiErrorToUserMessage. */

export interface ManagementAccountCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Padre pre-seleccionado al crear sub-cuenta; null = cuenta raíz. `type`/
   *  `destination` (si vienen) pre-pueblan el dominio del form. */
  parent: { id: string; name: string; type?: string; destination?: string } | null;
  /** Dominios válidos derivados del árbol existente. */
  typeOptions: string[];
  destinationOptions: string[];
}

const selectClass = cn(
  "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
);

export function ManagementAccountCreateDialog({
  open,
  onOpenChange,
  parent,
  typeOptions,
  destinationOptions,
}: ManagementAccountCreateDialogProps) {
  const create = useCreateManagementAccount();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: emptyAccountForm(
      parent?.id ?? "",
      parent?.type ?? "",
      parent?.destination ?? "",
    ),
    mode: "onBlur",
  });

  /* Re-sincroniza al abrir o cambiar de padre (sub-cuenta de otro nodo). */
  React.useEffect(() => {
    if (open) {
      reset(emptyAccountForm(parent?.id ?? "", parent?.type ?? "", parent?.destination ?? ""));
      setSubmitError(null);
    }
  }, [open, parent, reset]);

  async function onSubmit(values: AccountFormValues) {
    setSubmitError(null);
    try {
      await create.mutateAsync(formToCreateRequest({ ...values, parentId: parent?.id ?? "" }));
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
              Nueva cuenta de gestión
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            {parent ? (
              <>
                Sub-cuenta de <span className="font-medium text-neutral-dark">{parent.name}</span>.
              </>
            ) : (
              "Cuenta raíz (sin padre). Después podrás moverla o crear sub-cuentas dentro."
            )}
          </Dialog.Description>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="acct-code" className="text-sm font-medium text-neutral-dark">
                  Código
                </label>
                <Controller
                  control={control}
                  name="code"
                  render={({ field }) => (
                    <QavanteInput
                      id="acct-code"
                      placeholder="Ej: 1.1"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={Boolean(errors.code)}
                      aria-required="true"
                      aria-describedby={errors.code ? "acct-code-error" : undefined}
                    />
                  )}
                />
                {errors.code && (
                  <p id="acct-code-error" className="text-xs text-danger-500" role="alert">
                    {errors.code.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="acct-name" className="text-sm font-medium text-neutral-dark">
                  Nombre
                </label>
                <Controller
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <QavanteInput
                      id="acct-name"
                      placeholder="Ej: Ventas"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={Boolean(errors.name)}
                      aria-required="true"
                      aria-describedby={errors.name ? "acct-name-error" : undefined}
                    />
                  )}
                />
                {errors.name && (
                  <p id="acct-name-error" className="text-xs text-danger-500" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="acct-type" className="text-sm font-medium text-neutral-dark">
                  Tipo
                </label>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <select
                      id="acct-type"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      aria-invalid={Boolean(errors.type) || undefined}
                      aria-required="true"
                      className={cn(selectClass, errors.type && "border-danger-500")}
                    >
                      <option value="">Elige un tipo…</option>
                      {typeOptions.map((t) => (
                        <option key={t} value={t}>
                          {humanizeDomain(t)}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.type && (
                  <p className="text-xs text-danger-500" role="alert">
                    {errors.type.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="acct-destination" className="text-sm font-medium text-neutral-dark">
                  Destino
                </label>
                <Controller
                  control={control}
                  name="destination"
                  render={({ field }) => (
                    <select
                      id="acct-destination"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      aria-invalid={Boolean(errors.destination) || undefined}
                      aria-required="true"
                      className={cn(selectClass, errors.destination && "border-danger-500")}
                    >
                      <option value="">Elige un destino…</option>
                      {destinationOptions.map((d) => (
                        <option key={d} value={d}>
                          {humanizeDomain(d)}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.destination && (
                  <p className="text-xs text-danger-500" role="alert">
                    {errors.destination.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="acct-description" className="text-sm font-medium text-neutral-dark">
                Descripción <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <textarea
                    id="acct-description"
                    rows={2}
                    placeholder="Para qué se usa esta cuenta"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    className={cn(selectClass, "h-auto py-2")}
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
                Crear cuenta
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
