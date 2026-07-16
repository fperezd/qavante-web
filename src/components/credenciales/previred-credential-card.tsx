"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import {
  QavanteBadge,
  QavanteButton,
  QavanteCard,
  QavanteInlineError,
  QavanteInput,
} from "@/components/qavante";
import { usePreviredCredential, usePutPreviredCredential } from "@/lib/api/credentials";
import { isValidRut, normalizeRut } from "@/lib/validators/rut";
import { PasswordInput } from "./password-input";

/* Credencial de Previred (ADR-0070: cotizaciones → obligación real en Pagar). El backend la
   declara con `expected_keys = (username, password)`, donde `username` es el RUT del
   REPRESENTANTE LEGAL (no el de la empresa) y `password` su clave de Previred. Registrarla
   dispara el on-connect del sync (mismo patrón que BUK).

   La clave NO se almacena en el FE (regla 6): se manda al backend, que la cifra. El RUT se
   normaliza antes de enviar (el backend tolera con/sin puntos, pero no le mandamos basura).

   NO hay botón de "probar conexión": `POST /credential/test` valida la FORMA del payload, no
   el login contra el portal — prometer una prueba de conexión sería mentir. */

export function PreviredCredentialCard() {
  const { data, isLoading, isError, error } = usePreviredCredential();
  const put = usePutPreviredCredential();
  const [rut, setRut] = React.useState("");
  const [clave, setClave] = React.useState("");

  const active = data?.is_active ?? false;
  const rutOk = isValidRut(rut);
  const puedeGuardar = rutOk && clave.trim() !== "";
  // El error de RUT solo cuando ya escribió algo (no al abrir la pantalla).
  const rutInvalido = rut.trim() !== "" && !rutOk;

  function guardar() {
    if (!puedeGuardar) return;
    put.mutate(
      { username: normalizeRut(rut), password: clave },
      { onSuccess: () => setClave("") }, // el RUT queda a la vista; la clave nunca
    );
  }

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
            Previred
          </span>
          {!isLoading && (
            <QavanteBadge variant={active ? "success" : "default"}>
              {active ? "Configurado" : "No configurado"}
            </QavanteBadge>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-neutral-mid">
          {active
            ? "La credencial de Previred está configurada. Puedes reemplazarla si cambiaste la clave."
            : "Conecta Previred para que tus cotizaciones aparezcan como obligación en Pagar. Es el RUT del representante legal (no el de la empresa) y su clave de Previred. La guardamos cifrada; no queda en el navegador."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="previred-rut" className="block text-xs font-medium text-neutral-dark">
              RUT del representante legal
            </label>
            <QavanteInput
              id="previred-rut"
              variant="rut"
              value={rut}
              onValueChange={setRut}
              placeholder="12.345.678-9"
              autoComplete="off"
              invalid={rutInvalido}
              aria-describedby={rutInvalido ? "previred-rut-error" : undefined}
            />
            {rutInvalido && (
              <p id="previred-rut-error" className="text-xs text-danger-500">
                RUT inválido — revisa el dígito verificador.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="previred-clave" className="block text-xs font-medium text-neutral-dark">
              Clave de Previred
            </label>
            <PasswordInput
              id="previred-clave"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder={active ? "Nueva clave para reemplazar" : "Clave de Previred"}
              autoComplete="off"
              aria-label="Clave de Previred"
            />
          </div>
        </div>

        <QavanteButton onClick={guardar} loading={put.isPending} disabled={!puedeGuardar}>
          {active ? "Reemplazar credencial" : "Conectar Previred"}
        </QavanteButton>

        {put.isSuccess && !put.isPending && (
          <p className="text-xs text-success-700">
            Credencial guardada. Vamos a traer tus cotizaciones y aparecerán en Pagar.
          </p>
        )}
        {put.isError && <QavanteInlineError error={put.error} what="la credencial de Previred" />}
        {isError && (
          <QavanteInlineError error={error} what="el estado de la credencial de Previred" />
        )}
      </div>
    </QavanteCard>
  );
}
