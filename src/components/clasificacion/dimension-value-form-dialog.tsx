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
import { useCreateDimensionValue, useUpdateDimensionValue } from "@/lib/api/management";
import {
  valueFormSchema,
  emptyValueForm,
  valueToForm,
  formToCreateValueRequest,
  formToUpdateValueRequest,
  type ValueFormValues,
} from "./dimension-value-form-schema";
import type { DimensionValueTreeRow } from "./types";

/* Crear / editar un valor de una vista de gestión (addendum §15.5, POST/PATCH
   owner/admin). dimension=null+value=null → crear raíz; parent → crear
   sub-valor; value → editar. Base UI Dialog + rhf + zod. Lazy desde el drawer.
   El backend re-valida (409/422/403). */

export interface DimensionValueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dimensión dueña (para el POST de creación). */
  dimensionId: string;
  /** Si viene, es edición. */
  value: DimensionValueTreeRow | null;
  /** Padre pre-seleccionado al crear sub-valor; null = raíz. Ignorado en edición. */
  parent: { id: string; name: string } | null;
}

const textareaClass = cn(
  "flex w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
);

export function DimensionValueFormDialog({
  open,
  onOpenChange,
  dimensionId,
  value,
  parent,
}: DimensionValueFormDialogProps) {
  const isEdit = Boolean(value);
  const create = useCreateDimensionValue();
  const update = useUpdateDimensionValue();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ValueFormValues>({
    resolver: zodResolver(valueFormSchema),
    defaultValues: value ? valueToForm(value) : emptyValueForm(),
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (open) {
      reset(value ? valueToForm(value) : emptyValueForm());
      setSubmitError(null);
    }
  }, [open, value, reset]);

  async function onSubmit(values: ValueFormValues) {
    setSubmitError(null);
    try {
      if (value) {
        await update.mutateAsync({ valueId: value.id, body: formToUpdateValueRequest(values) });
      } else {
        await create.mutateAsync({
          dimensionId,
          body: formToCreateValueRequest(values, parent?.id ?? ""),
        });
      }
      onOpenChange(false);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? apiErrorToUserMessage(err) : "Error inesperado. Reintenta.",
      );
    }
  }

  const title = isEdit ? "Editar valor" : parent ? "Nuevo sub-valor" : "Nuevo valor";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-neutral-dark/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[70] max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          {parent && !isEdit && (
            <Dialog.Description className="mb-4 text-sm text-neutral-mid">
              Sub-valor de <span className="font-medium text-neutral-dark">{parent.name}</span>.
            </Dialog.Description>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="val-name" className="text-sm font-medium text-neutral-dark">
                Nombre
              </label>
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <QavanteInput
                    id="val-name"
                    placeholder="Ej: Obra Norte"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={Boolean(errors.name)}
                    aria-required="true"
                    aria-describedby={errors.name ? "val-name-error" : undefined}
                  />
                )}
              />
              {errors.name && (
                <p id="val-name-error" className="text-xs text-danger-500" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="val-code" className="text-sm font-medium text-neutral-dark">
                Código <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="code"
                render={({ field }) => (
                  <QavanteInput
                    id="val-code"
                    placeholder="Ej: ON-01"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="val-description" className="text-sm font-medium text-neutral-dark">
                Descripción <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <textarea
                    id="val-description"
                    rows={2}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    className={textareaClass}
                  />
                )}
              />
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
              <QavanteButton type="submit" loading={isSubmitting}>
                {isEdit ? "Guardar cambios" : "Crear valor"}
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
