"use client";

import * as React from "react";
import { Loader2, ImagePlus, CheckCircle2 } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { isValidRut, normalizeRut } from "@/lib/validators/rut";
import { useSiiContribuyente } from "@/lib/api/sii";

/* Formulario para AGREGAR una empresa (tenant). Vive en Administración → Empresas
   (agregar una empresa es configuración, no un atajo del header — Fernando
   2026-07-05). El RUT es obligatorio y al ingresarlo se consulta el SII
   (`/sii/contribuyente/{rut}`) para autocompletar la razón social. Presentacional
   para el submit: el caller pasa `pending`/`error` y maneja `onCreate`. */

export interface CreateCompanyFormProps {
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onCreate: (body: { legal_name: string; rut: string | null; trade_name: string | null }) => void;
}

export function CreateCompanyForm({ pending, error, onCancel, onCreate }: CreateCompanyFormProps) {
  const [rut, setRut] = React.useState("");
  const [legalName, setLegalName] = React.useState("");
  const [tradeName, setTradeName] = React.useState("");
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);
  /* RUT normalizado que dispara la consulta al SII (se setea al salir del campo). */
  const [lookupRut, setLookupRut] = React.useState("");
  /* ¿La razón social vino del SII (no la tipeó el usuario)? Si el usuario cambia el
     RUT después, limpiamos ese nombre autocompletado para no enviar RUT-nuevo con
     nombre-viejo. Un nombre tipeado a mano se respeta. */
  const [autoFilled, setAutoFilled] = React.useState(false);

  const rutValid = isValidRut(rut);
  const nameValid = legalName.trim().length >= 2;
  const canSubmit = rutValid && nameValid && !pending;

  const contribuyente = useSiiContribuyente(lookupRut, lookupRut.length > 0);
  const siiData = contribuyente.data;

  /* Autocompletar la razón social cuando el SII responde — pero NO pisar un nombre
     que el usuario ya tipeó (solo llenamos si el campo está vacío). */
  React.useEffect(() => {
    if (siiData?.status === "ok" && siiData.razon_social && legalName.trim() === "") {
      setLegalName(siiData.razon_social);
      setAutoFilled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siiData]);

  function onRutChange(v: string) {
    setRut(v);
    // El RUT cambió → el hint y (si aplica) el nombre autocompletado quedan stale.
    setLookupRut("");
    if (autoFilled) {
      setLegalName("");
      setAutoFilled(false);
    }
  }

  /* Preview local del logo (aún no se persiste — falta endpoint backend). */
  React.useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function lookupIfValid() {
    if (isValidRut(rut)) setLookupRut(normalizeRut(rut));
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onCreate({
      legal_name: legalName.trim(),
      rut: normalizeRut(rut),
      trade_name: tradeName.trim() || null,
    });
  }

  const siiNotFound = lookupRut.length > 0 && siiData?.status === "not_found";
  const siiFilled = siiData?.status === "ok" && Boolean(siiData.razon_social);
  const siiError = lookupRut.length > 0 && (contribuyente.isError || siiData?.status === "error");

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* RUT — obligatorio, dispara la consulta al SII. */}
        <div className="space-y-1">
          <label htmlFor="cs-rut" className="text-sm font-medium text-neutral-dark">
            RUT de la empresa
          </label>
          <QavanteInput
            id="cs-rut"
            variant="rut"
            placeholder="76.123.456-0"
            value={rut}
            onValueChange={onRutChange}
            onBlur={lookupIfValid}
            invalid={touched && !rutValid}
            aria-describedby="cs-rut-hint"
          />
          <p id="cs-rut-hint" className="min-h-4 text-xs">
            {contribuyente.isFetching ? (
              <span className="inline-flex items-center gap-1 text-neutral-mid">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Buscando en el SII…
              </span>
            ) : siiFilled ? (
              <span className="inline-flex items-center gap-1 text-success-700">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Datos traídos del SII
              </span>
            ) : siiError ? (
              <span className="text-warning-700">
                No pudimos consultar el SII. Ingresa la razón social a mano.
              </span>
            ) : siiNotFound ? (
              <span className="text-neutral-mid">
                No encontramos datos en el SII. Ingresa la razón social a mano.
              </span>
            ) : touched && !rutValid ? (
              <span className="text-danger-500">Ingresa un RUT válido.</span>
            ) : (
              <span className="text-neutral-mid">
                Al ingresarlo traemos la razón social del SII.
              </span>
            )}
          </p>
        </div>

        {/* Razón social — obligatoria, autocompletada pero editable. */}
        <div className="space-y-1">
          <label htmlFor="cs-legal-name" className="text-sm font-medium text-neutral-dark">
            Razón social
          </label>
          <QavanteInput
            id="cs-legal-name"
            placeholder="Tooxs Digital SpA"
            value={legalName}
            onValueChange={(v) => {
              setLegalName(v);
              setAutoFilled(false); // el usuario la editó → ya no es "del SII"
            }}
            invalid={touched && !nameValid}
          />
          {touched && !nameValid && (
            <p className="text-xs text-danger-500" role="alert">
              Ingresa la razón social (mínimo 2 caracteres).
            </p>
          )}
        </div>

        {/* Nombre comercial — opcional. */}
        <div className="space-y-1">
          <label htmlFor="cs-trade-name" className="text-sm font-medium text-neutral-dark">
            Nombre comercial <span className="font-normal text-neutral-mid">(opcional)</span>
          </label>
          <QavanteInput
            id="cs-trade-name"
            placeholder="Qavante"
            value={tradeName}
            onValueChange={setTradeName}
          />
        </div>

        {/* Logo — opcional, para más adelante (aún no se persiste). */}
        <div className="space-y-1">
          <span className="text-sm font-medium text-neutral-dark">
            Logo <span className="font-normal text-neutral-mid">(opcional)</span>
          </span>
          <label
            htmlFor="cs-logo"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-muted px-3 py-2 text-sm text-neutral-mid hover:border-brand-primary/40"
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Logo de la empresa"
                className="h-8 w-8 rounded object-cover"
              />
            ) : (
              <ImagePlus className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{logoPreview ? "Cambiar logo" : "Subir logo"}</span>
            <input
              id="cs-logo"
              type="file"
              accept="image/*"
              onChange={onLogoChange}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {error instanceof ApiError && (
        <p className="text-sm text-danger-500" role="alert">
          {apiErrorToUserMessage(error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <QavanteButton
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          Cancelar
        </QavanteButton>
        <QavanteButton type="submit" size="sm" loading={pending} disabled={!canSubmit}>
          Agregar empresa
        </QavanteButton>
      </div>
    </form>
  );
}
