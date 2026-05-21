"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Upload } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { PasswordInput } from "./password-input";
import { useUploadCertificatePfx } from "@/lib/api/credentials";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { isValidRut } from "@/lib/validators/rut";

/* Upload de certificado digital (.pfx) — Opción A multi-holder. La password
   del .pfx se usa para extraer metadata; NO se almacena (regla 6).
   rut_holder es opcional: el backend intenta extraerlo del subject; si no
   puede, lo exige (422). password_hint es ayuda visual del usuario. */

const schema = z.object({
  password: z.string().min(1, "Password del .pfx requerida"),
  password_hint: z.string().max(200).optional().or(z.literal("")),
  rut_holder: z
    .string()
    .optional()
    .refine((v) => !v || isValidRut(v), "RUT inválido")
    .or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      // readAsDataURL → "data:...;base64,<payload>"; quitar el prefijo.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export function CertificateUploadDialogV2({ open, onOpenChange }: Props) {
  const upload = useUploadCertificatePfx();
  const [file, setFile] = React.useState<File | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", password_hint: "", rut_holder: "" },
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (!open) {
      reset({ password: "", password_hint: "", rut_holder: "" });
      setFile(null);
      setSubmitError(null);
    }
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    if (!file) {
      setSubmitError("Seleccioná un archivo .pfx.");
      return;
    }
    try {
      const pfx_base64 = await fileToBase64(file);
      await upload.mutateAsync({
        pfx_base64,
        password: values.password,
        password_hint: values.password_hint || null,
        rut_holder: values.rut_holder || null,
      });
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? apiErrorToUserMessage(err) : "Error inesperado.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              Subir certificado digital
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            Archivo .pfx/.p12. La clave del .pfx se usa para validar; no se almacena.
          </Dialog.Description>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="cert-file"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-neutral-light bg-neutral-light/20 px-4 py-6 text-sm text-neutral-mid hover:bg-neutral-light/30 focus-within:ring-2 focus-within:ring-brand-primary"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {file ? (
                  <span className="font-medium text-neutral-dark">{file.name}</span>
                ) : (
                  "Elegí un archivo .pfx"
                )}
              </label>
              <input
                id="cert-file"
                type="file"
                accept=".pfx,.p12"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cert-pwd" className="text-sm font-medium text-neutral-dark">
                Clave del .pfx
              </label>
              <PasswordInput
                id="cert-pwd"
                placeholder="Clave del archivo"
                invalid={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-danger-500" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="cert-hint" className="text-sm font-medium text-neutral-dark">
                Pista para recordar la clave <span className="text-neutral-mid">(opcional)</span>
              </label>
              <QavanteInput
                id="cert-hint"
                placeholder="Ej: 'la del banco'"
                {...register("password_hint")}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cert-rut" className="text-sm font-medium text-neutral-dark">
                RUT del titular <span className="text-neutral-mid">(opcional)</span>
              </label>
              <Controller
                control={control}
                name="rut_holder"
                render={({ field }) => (
                  <QavanteInput
                    id="cert-rut"
                    variant="rut"
                    placeholder="Si se omite, se intenta extraer del certificado"
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={Boolean(errors.rut_holder)}
                  />
                )}
              />
              {errors.rut_holder && (
                <p className="text-xs text-danger-500" role="alert">
                  {errors.rut_holder.message}
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
              <QavanteButton type="submit" loading={isSubmitting} disabled={!file}>
                Subir
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
