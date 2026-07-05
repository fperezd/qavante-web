"use client";

import * as React from "react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { isValidRut } from "@/lib/validators/rut";

/* Formulario para crear una empresa (tenant). Vive en Administración → Empresas
   (antes estaba en el selector del header; crear una empresa es configuración,
   no un atajo de navegación — pedido de Fernando 2026-07-05). Presentacional:
   el caller le pasa `pending`/`error` y maneja el `onCreate`. */

export interface CreateCompanyFormProps {
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onCreate: (body: { legal_name: string; rut: string | null; trade_name: string | null }) => void;
}

export function CreateCompanyForm({ pending, error, onCancel, onCreate }: CreateCompanyFormProps) {
  const [legalName, setLegalName] = React.useState("");
  const [rut, setRut] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const nameValid = legalName.trim().length >= 2;
  const rutValid = rut.trim().length === 0 || isValidRut(rut);
  const canSubmit = nameValid && rutValid && !pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onCreate({ legal_name: legalName.trim(), rut: rut.trim() || null, trade_name: null });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="cs-legal-name" className="text-sm font-medium text-neutral-dark">
            Razón social
          </label>
          <QavanteInput
            id="cs-legal-name"
            placeholder="Tooxs Digital SpA"
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
          <label htmlFor="cs-rut" className="text-sm font-medium text-neutral-dark">
            RUT (opcional)
          </label>
          <QavanteInput
            id="cs-rut"
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
          Crear y entrar
        </QavanteButton>
      </div>
    </form>
  );
}
