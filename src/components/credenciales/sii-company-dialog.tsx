"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { PasswordInput } from "./password-input";
import { useSetCompanyCredentials, type SiiCompanyStatus } from "@/lib/api/credentials";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { isValidRut } from "@/lib/validators/rut";

const schema = z.object({
  rut: z.string().min(1, "RUT requerido").refine(isValidRut, "RUT inválido"),
  password: z.string().min(4, "Mínimo 4 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: SiiCompanyStatus;
}

export function SiiCompanyDialog({ open, onOpenChange, company }: Props) {
  const mutate = useSetCompanyCredentials();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rut: company.rut ?? "", password: "" },
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (!open) {
      reset({ rut: company.rut ?? "", password: "" });
      setSubmitError(null);
    }
  }, [open, company.rut, reset]);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      await mutate.mutateAsync(values);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "rut_mismatch") {
        setSubmitError("El RUT no coincide con el RUT de la empresa del tenant.");
      } else {
        setSubmitError(err instanceof ApiError ? apiErrorToUserMessage(err) : "Error inesperado.");
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              {company.configured ? "Cambiar clave SII empresa" : "Configurar clave SII empresa"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            La clave se encripta antes de guardarse. Después de guardar, no se muestra más.
          </Dialog.Description>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="company-rut" className="text-sm font-medium text-neutral-dark">
                RUT empresa
              </label>
              <Controller
                control={control}
                name="rut"
                render={({ field }) => (
                  <QavanteInput
                    id="company-rut"
                    variant="rut"
                    placeholder="76.123.456-7"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={Boolean(errors.rut)}
                    disabled={Boolean(company.rut)}
                  />
                )}
              />
              {errors.rut && (
                <p className="text-xs text-danger-500" role="alert">
                  {errors.rut.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="company-pwd" className="text-sm font-medium text-neutral-dark">
                Clave SII
              </label>
              <PasswordInput
                id="company-pwd"
                placeholder="Tu clave del portal SII"
                invalid={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-danger-500" role="alert">
                  {errors.password.message}
                </p>
              )}
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
              <QavanteButton type="submit" loading={isSubmitting}>
                Guardar
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
