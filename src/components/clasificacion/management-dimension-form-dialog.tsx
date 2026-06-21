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
import { useCreateDimension, useUpdateDimension } from "@/lib/api/management";
import { DATA_TYPE_OPTIONS } from "./dimension-labels";
import {
  dimensionFormSchema,
  emptyDimensionForm,
  dimensionToForm,
  formToCreateDimensionRequest,
  formToUpdateDimensionRequest,
  type DimensionFormValues,
} from "./management-dimension-form-schema";
import type { ManagementDimensionRow } from "./types";

/* Crear / editar una vista de gestión (dimensión) — addendum §15, POST/PATCH
   owner/admin. Un mismo dialog cubre los dos casos (dimension=null → crear).
   Base UI Dialog + react-hook-form + zod (patrón rule-form-dialog). Lazy desde
   el container. `code` es la clave natural: editable al crear, read-only al
   editar (no se manda en el PATCH). El backend re-valida (409/403). */

export interface ManagementDimensionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si viene, es edición; si es null, es creación. */
  dimension: ManagementDimensionRow | null;
}

const selectClass = cn(
  "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
);

const CHECKS: ReadonlyArray<{
  name: keyof Pick<
    DimensionFormValues,
    "isRequired" | "isVisible" | "allowsHierarchy" | "allowsMultiple"
  >;
  label: string;
  hint: string;
}> = [
  { name: "isRequired", label: "Obligatoria", hint: "Hay que asignarla al clasificar." },
  { name: "isVisible", label: "Visible", hint: "Aparece en los selectores de clasificación." },
  { name: "allowsHierarchy", label: "Jerárquica", hint: "Sus valores pueden anidarse en árbol." },
  {
    name: "allowsMultiple",
    label: "Permite varios valores",
    hint: "Se puede asignar más de un valor a la vez.",
  },
];

export function ManagementDimensionFormDialog({
  open,
  onOpenChange,
  dimension,
}: ManagementDimensionFormDialogProps) {
  const isEdit = Boolean(dimension);
  const create = useCreateDimension();
  const update = useUpdateDimension();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DimensionFormValues>({
    resolver: zodResolver(dimensionFormSchema),
    defaultValues: dimension ? dimensionToForm(dimension) : emptyDimensionForm(),
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (open) {
      reset(dimension ? dimensionToForm(dimension) : emptyDimensionForm());
      setSubmitError(null);
    }
  }, [open, dimension, reset]);

  async function onSubmit(values: DimensionFormValues) {
    setSubmitError(null);
    try {
      if (dimension) {
        await update.mutateAsync({
          dimensionId: dimension.id,
          body: formToUpdateDimensionRequest(values),
        });
      } else {
        await create.mutateAsync(formToCreateDimensionRequest(values));
      }
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
              {isEdit ? "Editar vista de gestión" : "Nueva vista de gestión"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            Las vistas te dejan mirar tu negocio por cliente, proyecto, obra, local u otra variable.
          </Dialog.Description>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="dim-code" className="text-sm font-medium text-neutral-dark">
                  Código
                </label>
                <Controller
                  control={control}
                  name="code"
                  render={({ field }) => (
                    <QavanteInput
                      id="dim-code"
                      placeholder="Ej: proyecto"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={Boolean(errors.code)}
                      // Clave natural inmutable: read-only al editar.
                      disabled={isEdit}
                      aria-required="true"
                      aria-describedby={errors.code ? "dim-code-error" : undefined}
                    />
                  )}
                />
                {isEdit && (
                  <p className="text-xs text-neutral-mid">El código no se puede cambiar.</p>
                )}
                {errors.code && (
                  <p id="dim-code-error" className="text-xs text-danger-500" role="alert">
                    {errors.code.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="dim-name" className="text-sm font-medium text-neutral-dark">
                  Nombre
                </label>
                <Controller
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <QavanteInput
                      id="dim-name"
                      placeholder="Ej: Proyecto"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={Boolean(errors.name)}
                      aria-required="true"
                      aria-describedby={errors.name ? "dim-name-error" : undefined}
                    />
                  )}
                />
                {errors.name && (
                  <p id="dim-name-error" className="text-xs text-danger-500" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="dim-type" className="text-sm font-medium text-neutral-dark">
                Tipo de dato
              </label>
              <Controller
                control={control}
                name="dataType"
                render={({ field }) => (
                  <select
                    id="dim-type"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className={selectClass}
                  >
                    {DATA_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="dim-description" className="text-sm font-medium text-neutral-dark">
                Descripción <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <textarea
                    id="dim-description"
                    rows={2}
                    placeholder="Para qué sirve esta vista"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    className={cn(selectClass, "h-auto py-2")}
                  />
                )}
              />
            </div>

            <fieldset className="space-y-2 rounded-md border border-neutral-light bg-neutral-light/20 p-3">
              <legend className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-mid">
                Opciones
              </legend>
              {CHECKS.map((c) => (
                <Controller
                  key={c.name}
                  control={control}
                  name={c.name}
                  render={({ field }) => (
                    <label className="flex items-start gap-2 text-sm text-neutral-dark">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-neutral-light text-brand-primary"
                      />
                      <span>
                        {c.label}
                        <span className="block text-xs text-neutral-mid">{c.hint}</span>
                      </span>
                    </label>
                  )}
                />
              ))}
            </fieldset>

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
                {isEdit ? "Guardar cambios" : "Crear vista"}
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
