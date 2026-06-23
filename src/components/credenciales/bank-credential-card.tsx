"use client";

import * as React from "react";
import { AlertCircle, Landmark, Loader2 } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton, QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useBiceCredentialStatus, usePutBiceCredential } from "@/lib/api/bank-credentials";
import { isValidRut } from "@/lib/validators/rut";

/* Card de conexión bancaria (BICE). Conecta/rota las credenciales del banco
   (`PUT /api/credentials/bice`, RUT + clave de acceso) y muestra el estado
   (`GET /api/credentials/bice`). Conexión de solo lectura: nunca movemos plata.
   La clave se cifra antes de guardarse. Análogo a SiiCredentialCard. */
export function BankCredentialCard() {
  const status = useBiceCredentialStatus();
  const save = usePutBiceCredential();
  const [editing, setEditing] = React.useState(false);
  const [rut, setRut] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const connected = status.data?.connected ?? false;
  const rutValid = isValidRut(rut);
  const canSubmit = rutValid && password.length >= 4;
  const showForm = editing || (!connected && !status.isLoading && !status.isError);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    save.mutate(
      { rut, password },
      {
        onSuccess: () => {
          setEditing(false);
          setRut("");
          setPassword("");
          setTouched(false);
        },
      },
    );
  }

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span>Banco BICE</span>
        </div>
      }
    >
      {status.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-mid">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Cargando estado de la conexión…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <p className="text-neutral-mid">Conexión bancaria (solo lectura)</p>
            <QavanteBadge variant={connected ? "success" : "default"}>
              {connected ? "Conectado" : "No conectado"}
            </QavanteBadge>
          </div>

          {!showForm && (
            <div className="flex justify-end pt-1">
              <QavanteButton size="sm" variant="ghost" onClick={() => setEditing(true)}>
                {connected ? "Cambiar credenciales" : "Conectar banco"}
              </QavanteButton>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} noValidate className="space-y-3 pt-1">
              <p className="text-sm text-neutral-mid">
                Ingresa tus datos de acceso al banco para traer tus movimientos automáticamente. La
                clave se cifra antes de guardarse.
              </p>

              <div className="space-y-1">
                <label htmlFor="bank-rut" className="text-sm font-medium text-neutral-dark">
                  RUT
                </label>
                <QavanteInput
                  id="bank-rut"
                  variant="rut"
                  placeholder="76.123.456-7"
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

              <div className="space-y-1">
                <label htmlFor="bank-clave" className="text-sm font-medium text-neutral-dark">
                  Clave de acceso al banco
                </label>
                <PasswordInput
                  id="bank-clave"
                  placeholder="Tu clave del banco"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  invalid={touched && password.length < 4}
                />
              </div>

              {save.isError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <p>
                    {save.error instanceof ApiError
                      ? apiErrorToUserMessage(save.error)
                      : "No pudimos conectar el banco. Verifica tus datos e intenta de nuevo."}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                {(connected || editing) && (
                  <QavanteButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setRut("");
                      setPassword("");
                      setTouched(false);
                    }}
                  >
                    Cancelar
                  </QavanteButton>
                )}
                <QavanteButton
                  type="submit"
                  size="sm"
                  loading={save.isPending}
                  disabled={!canSubmit}
                >
                  Conectar banco
                </QavanteButton>
              </div>
            </form>
          )}
        </div>
      )}
    </QavanteCard>
  );
}
