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
import { formatDateLike } from "@/lib/formatters/date";
import { PasswordInput } from "./password-input";
import { debeMostrarForm } from "./previred-estado-conexion-model";

/* Credencial de Previred. El backend la declara con `expected_keys = (username, password)`, donde
   `username` es el RUT del REPRESENTANTE LEGAL (no el de la empresa) y `password` su clave.

   OJO con la copy: ADR-0070 planea que las cotizaciones no pagadas se vuelvan obligación en Pagar,
   pero eso NO está construido (verificado 16-07-2026 en qavante-api: el `upsert_cotizacion_payable`
   y el wiring de §Wiring —cron 6h + on-connect— no existen; `/api/previred/cotizaciones` es
   `require_api_key` e `include_in_schema=False`). Registrar la credencial hoy NO hace aparecer
   nada en Pagar → no prometerlo acá (§13, faltante ≠ 0). El estado honesto de los dos pasos lo
   muestra `PreviredEstadoConexion`.

   La clave NO se almacena en el FE (regla 6): se manda al backend, que la cifra. El RUT se
   normaliza antes de enviar (el backend tolera con/sin puntos, pero no le mandamos basura).

   NO hay botón de "probar conexión": `POST /credential/test` valida la FORMA del payload, no
   el login contra el portal — prometer una prueba de conexión sería mentir. */

export function PreviredCredentialCard() {
  const { data, isLoading, isError, error } = usePreviredCredential();
  const put = usePutPreviredCredential();
  const [editando, setEditando] = React.useState(false);
  const [rut, setRut] = React.useState("");
  const [clave, setClave] = React.useState("");

  const active = data?.is_active ?? false;
  const rutOk = isValidRut(rut);
  const puedeGuardar = rutOk && clave.trim() !== "";
  // El error de RUT solo cuando ya escribió algo (no al abrir la pantalla).
  const rutInvalido = rut.trim() !== "" && !rutOk;
  // Configurada → el formulario NO queda a la vista (igual que banco y SII): resumen + "Cambiar".
  // La decisión vive en el modelo puro (con unit tests): acá no se puede testear porque el runner
  // de Storybook no corre MSW → `is_active` nunca llega true.
  const mostrarForm = debeMostrarForm({ editando, claveActiva: active, cargando: isLoading });

  function cerrar() {
    setEditando(false);
    setRut("");
    setClave("");
  }

  function guardar() {
    if (!puedeGuardar) return;
    put.mutate(
      { username: normalizeRut(rut), password: clave },
      // Guardada → cierra y limpia. La clave no queda en el navegador (regla 6) y el RUT tampoco
      // tiene por qué: el backend no lo devuelve, así que dejarlo a la vista era un espejismo del
      // estado local (tras un F5 quedaba el campo vacío con el badge "Configurado").
      { onSuccess: cerrar },
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
            ? "La credencial de Previred está configurada. Si cambiaste la clave en Previred, reemplázala acá."
            : "Guarda la clave con que Previred te deja entrar, para que Qavante pueda consultar en nombre de tu empresa. Es el RUT del representante legal (no el de la empresa) y su clave. La guardamos cifrada; no queda en el navegador."}
        </p>

        {active && data?.created_at && !mostrarForm && (
          <p className="text-xs text-neutral-mid">Configurada: {formatDateLike(data.created_at)}</p>
        )}

        {!mostrarForm && (
          <div className="flex justify-end">
            <QavanteButton size="sm" variant="ghost" onClick={() => setEditando(true)}>
              Cambiar credenciales
            </QavanteButton>
          </div>
        )}

        {mostrarForm && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="previred-rut"
                  className="block text-xs font-medium text-neutral-dark"
                >
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
                    RUT inválido, revisa el dígito verificador.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="previred-clave"
                  className="block text-xs font-medium text-neutral-dark"
                >
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

            <div className="flex flex-wrap items-center gap-2">
              <QavanteButton onClick={guardar} loading={put.isPending} disabled={!puedeGuardar}>
                {active ? "Reemplazar credencial" : "Conectar Previred"}
              </QavanteButton>
              {editando && (
                <QavanteButton size="sm" variant="ghost" onClick={cerrar}>
                  Cancelar
                </QavanteButton>
              )}
            </div>
          </>
        )}

        {put.isSuccess && !put.isPending && (
          <p className="text-xs text-success-700">Credencial guardada.</p>
        )}
        {put.isError && <QavanteInlineError error={put.error} what="la credencial de Previred" />}
        {isError && (
          <QavanteInlineError error={error} what="el estado de la credencial de Previred" />
        )}
      </div>
    </QavanteCard>
  );
}
