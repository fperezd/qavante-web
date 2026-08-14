"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { usePutSiiCredential } from "@/lib/api/credentials";
import { useOnboardingSources } from "@/lib/api/onboarding-sources";
import { deferSource, undeferSource } from "@/lib/onboarding/deferred-sources";
import { isValidRut } from "@/lib/validators/rut";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";

/* Paso 3 — Conectar SII. Guarda la clave tributaria (RUT + clave) para traer
   documentos del SII. Reusa el data layer de credenciales (`usePutSiiCredential`,
   `/api/admin/sources/sii_rcv/credential`).

   Paso DIFERIBLE — patrón "siempre wizard, con conexiones diferibles"
   (Fernando 2026-08-12): si el usuario no tiene la clave a mano, "Conectar
   después" avanza el wizard y deja la fuente pendiente en el hub de conexiones
   (`/onboarding/conexiones`). Nada bloquea el registro.

   ⚠️ Esos endpoints son api-key-only en prod (gap escalado a CC-API) — el wizard
   está gated `onboarding` OFF hasta que acepten cookie. */

const NEXT = routeAfter("connect-sii");

export function ConnectSiiView() {
  const router = useRouter();
  const save = usePutSiiCredential();
  const { states } = useOnboardingSources(true);
  const connected = states.sii === "connected";
  const [rut, setRut] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const rutValid = isValidRut(rut);
  // `>= 4` alinea con el dialog de Credenciales (misma clave SII); `!isPending`
  // corta el doble-submit (Enter repetido antes de que React deshabilite).
  const canSubmit = rutValid && password.length >= 4 && !save.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    save.mutate(
      { rut, password },
      {
        onSuccess: () => {
          // Conectada = ya no está diferida (si el usuario la había pospuesto).
          undeferSource("sii");
          router.push(NEXT);
        },
      },
    );
  }

  /** "Conectar después": decisión explícita del usuario, no un descarte silencioso. */
  function handleDefer() {
    deferSource("sii");
    router.push(NEXT);
  }

  return (
    <OnboardingShell
      step="connect-sii"
      description="Conecta el SII con tu clave tributaria para traer tus facturas, boletas e impuestos automáticamente."
    >
      <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-4">
        {connected && (
          <div
            className="flex items-start gap-3 rounded-xl border border-success-500/30 bg-success-500/5 p-3 text-sm text-neutral-dark"
            role="status"
          >
            <CheckCircle2
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-success-600"
              aria-hidden="true"
            />
            <p>
              Ya tienes el SII conectado. Puedes continuar; solo vuelve a ingresar los datos si
              cambiaste tu clave tributaria.
            </p>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl border border-info-500/30 bg-info-500/5 p-3 text-sm text-neutral-dark">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-info-600" aria-hidden="true" />
          <p>
            Usa el RUT y la clave tributaria del <strong>representante legal</strong> (con los que
            ingresa al SII). Se guardan cifrados y solo se usan para consultar tus datos.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="sii-rut" className="text-sm font-medium text-neutral-dark">
            RUT del representante legal
          </label>
          <QavanteInput
            id="sii-rut"
            variant="rut"
            placeholder="12.345.678-5"
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
          <label htmlFor="sii-clave" className="text-sm font-medium text-neutral-dark">
            Clave tributaria
          </label>
          <PasswordInput
            id="sii-clave"
            placeholder="Tu clave del SII"
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
                : "No pudimos conectar el SII. Verifica tus datos e intenta de nuevo."}
            </p>
          </div>
        )}

        {/* Honestidad: decimos QUÉ pasa si lo dejas para después, sin dramatizar
            y sin prometer datos que no vamos a tener. */}
        {!connected && (
          <p className="text-xs text-neutral-mid">
            ¿No tienes la clave a mano? Sigue sin problema: hasta que conectes el SII no vamos a
            mostrar tus ventas, compras ni impuestos (no los inventamos). Puedes conectarlo cuando
            quieras desde <strong>Tus conexiones</strong>.
          </p>
        )}

        <OnboardingStepActions
          continueType="submit"
          continueLabel={connected ? "Actualizar y continuar" : "Conectar y continuar"}
          continueLoading={save.isPending}
          continueDisabled={!canSubmit}
          onSkip={connected ? () => router.push(NEXT) : handleDefer}
          skipLabel={connected ? "Continuar" : "Conectar después"}
        />
      </form>
    </OnboardingShell>
  );
}
