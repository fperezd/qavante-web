"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { FileUp, X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { PasswordInput } from "./password-input";
import { useUploadCertificate } from "@/lib/api/credentials";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReplacement?: boolean;
}

const MAX_BYTES = 100 * 1024;
const ACCEPT_EXT = [".pfx", ".p12"];

export function CertificateUploadDialog({ open, onOpenChange, isReplacement }: Props) {
  const upload = useUploadCertificate();
  const [file, setFile] = React.useState<File | null>(null);
  const [password, setPassword] = React.useState("");
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setPassword("");
      setFileError(null);
      setSubmitError(null);
    }
  }, [open]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    const name = f.name.toLowerCase();
    if (!ACCEPT_EXT.some((ext) => name.endsWith(ext))) {
      setFileError("El archivo debe ser .pfx o .p12.");
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError("El archivo supera el tamaño máximo (100 KB).");
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!file) {
      setFileError("Seleccioná un archivo de certificado.");
      return;
    }
    if (password.length < 4) {
      setSubmitError("La clave del certificado es muy corta.");
      return;
    }
    try {
      await upload.mutateAsync({ file, password });
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error inesperado.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-neutral-dark/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-dark">
              {isReplacement ? "Reemplazar certificado digital" : "Cargar certificado digital"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/40 hover:text-neutral-dark"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-neutral-mid">
            Archivo PKCS#12 (.pfx o .p12) emitido por E-Sign, E-Cert Chile u otra entidad
            certificadora autorizada por SII. Máximo 100 KB.
          </Dialog.Description>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="cert-file" className="text-sm font-medium text-neutral-dark">
                Archivo
              </label>
              <label
                htmlFor="cert-file"
                className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-neutral-light bg-surface text-sm text-neutral-mid hover:border-brand-primary hover:bg-brand-primary-50/40"
              >
                <FileUp className="h-5 w-5" aria-hidden="true" />
                {file ? (
                  <span className="font-medium text-neutral-dark">{file.name}</span>
                ) : (
                  <span>Click para elegir .pfx o .p12</span>
                )}
              </label>
              <input
                id="cert-file"
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                className="hidden"
                onChange={onFileChange}
              />
              {fileError && (
                <p className="text-xs text-danger-500" role="alert">
                  {fileError}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="cert-pwd" className="text-sm font-medium text-neutral-dark">
                Clave del certificado
              </label>
              <PasswordInput
                id="cert-pwd"
                placeholder="Clave del .pfx"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={Boolean(submitError && password.length < 4)}
              />
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
              <QavanteButton type="submit" loading={upload.isPending}>
                Subir certificado
              </QavanteButton>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
