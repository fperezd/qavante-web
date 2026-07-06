"use client";

import * as React from "react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { isValidRut, normalizeRut } from "@/lib/validators/rut";
import type { UpdateTenantBody } from "@/lib/api/tenants";

/* Editar los datos de la empresa ACTIVA (`PUT /api/admin/tenant`). Partial update:
   solo se envían razón social + RUT (que conocemos) y el nombre comercial SI el
   usuario lo completa — no lo mandamos vacío para no borrar uno existente que el
   FE no conoce (el contrato de la lista no expone trade_name). Presentacional. */

export interface EditCompanyFormProps {
  initialLegalName: string;
  /** RUT actual (de `/api/me` company_rut), ya normalizado o con formato. */
  initialRut: string;
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  /** Recibe SOLO los campos a actualizar (partial): los vacíos se omiten para no
   *  borrar en el backend (null = borrar en un partial update). */
  onSave: (body: UpdateTenantBody) => void;
}

export function EditCompanyForm({
  initialLegalName,
  initialRut,
  pending,
  error,
  onCancel,
  onSave,
}: EditCompanyFormProps) {
  const [legalName, setLegalName] = React.useState(initialLegalName);
  const [rut, setRut] = React.useState(initialRut);
  const [tradeName, setTradeName] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  /* `initialRut` (de /api/me) puede llegar DESPUÉS de montar (cache fría). Si el
     campo sigue vacío y llega el RUT real, lo poblamos — sin pisar lo que el
     usuario ya tipeó. */
  React.useEffect(() => {
    if (initialRut) setRut((cur) => (cur === "" ? initialRut : cur));
  }, [initialRut]);

  const nameValid = legalName.trim().length >= 2;
  // RUT opcional al editar (puede venir vacío si no lo teníamos); si hay, válido.
  const rutValid = rut.trim().length === 0 || isValidRut(rut);
  const canSubmit = nameValid && rutValid && !pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    /* Partial update: SOLO mandamos lo que tiene valor. Un campo vacío se OMITE
       (no `null`), para no borrar en el backend lo que no tocamos. */
    const body: UpdateTenantBody = { legal_name: legalName.trim() };
    if (rut.trim()) body.rut = normalizeRut(rut);
    if (tradeName.trim()) body.trade_name = tradeName.trim();
    onSave(body);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="ec-legal-name" className="text-sm font-medium text-neutral-dark">
            Razón social
          </label>
          <QavanteInput
            id="ec-legal-name"
            value={legalName}
            onValueChange={setLegalName}
            invalid={touched && !nameValid}
          />
          {touched && !nameValid && (
            <p className="text-xs text-danger-500" role="alert">
              Ingresa la razón social (mínimo 2 caracteres).
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="ec-rut" className="text-sm font-medium text-neutral-dark">
            RUT
          </label>
          <QavanteInput
            id="ec-rut"
            variant="rut"
            placeholder="76.123.456-0"
            value={rut}
            onValueChange={setRut}
            invalid={touched && !rutValid}
          />
          {touched && !rutValid && (
            <p className="text-xs text-danger-500" role="alert">
              Ingresa un RUT válido.
            </p>
          )}
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="ec-trade-name" className="text-sm font-medium text-neutral-dark">
            Nombre comercial <span className="font-normal text-neutral-mid">(opcional)</span>
          </label>
          <QavanteInput
            id="ec-trade-name"
            placeholder="Déjalo vacío para no cambiarlo"
            value={tradeName}
            onValueChange={setTradeName}
          />
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
          Guardar cambios
        </QavanteButton>
      </div>
    </form>
  );
}
