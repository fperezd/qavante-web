"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { QavanteInlineError, QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { usePutSiiCredential } from "@/lib/api/credentials";
import {
  monthValue,
  startDateForMonth,
  useOnboardingImportWindow,
  useSetOnboardingImportWindow,
} from "@/lib/api/onboarding-import-window";
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

   ⚠️ CORRECCIÓN (review del PR #935): este comentario afirmaba que el wizard
   estaba "gated `onboarding` OFF hasta que acepten cookie". Es FALSO y hacía
   subestimar el blast radius: `NEXT_PUBLIC_FF_ONBOARDING = "true"` en
   `wrangler.toml` desde 2026-06-22, o sea este paso corre EN PRODUCCIÓN. El gap
   real es que los endpoints de credenciales del SII fueron api-key-only; por eso
   van blindados con `skipAuthRetry` (un 401 acá muestra error inline y no
   expulsa al login). */

const NEXT = routeAfter("connect-sii");

export function ConnectSiiView() {
  const router = useRouter();
  const save = usePutSiiCredential();
  const importWindow = useOnboardingImportWindow();
  const setImportWindow = useSetOnboardingImportWindow();
  const { states } = useOnboardingSources(true);
  const connected = states.sii === "connected";
  const [rut, setRut] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [startDate, setStartDate] = React.useState("");

  React.useEffect(() => {
    if (importWindow.data && !startDate) setStartDate(importWindow.data.start_date);
  }, [importWindow.data, startDate]);

  const rutValid = isValidRut(rut);
  // `>= 4` alinea con el dialog de Credenciales (misma clave SII); `!isPending`
  // corta el doble-submit (Enter repetido antes de que React deshabilite).
  const canSubmit =
    rutValid &&
    password.length >= 4 &&
    Boolean(startDate) &&
    importWindow.isSuccess &&
    !save.isPending &&
    !setImportWindow.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    try {
      // La fecha va ANTES de la credencial: guardar la clave dispara el sync
      // inicial y nunca debe usar un rango distinto del que el dueño eligió.
      await setImportWindow.mutateAsync({ start_date: startDate });
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
    } catch {
      // El error queda visible bajo la elección de período; no guardamos secretos.
    }
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

        <section className="space-y-2 rounded-xl border border-border bg-surface-muted p-4">
          <div>
            <h2 className="text-sm font-medium text-neutral-dark">¿Desde qué mes leemos?</h2>
            <p className="mt-1 text-xs text-neutral-mid">
              Traeremos hasta seis meses antes de tu registro. Elegir un mes no cambia nada de tu
              información; solo define desde dónde empezamos a leerla.
            </p>
          </div>

          {importWindow.isLoading && (
            <p className="flex items-center gap-2 text-sm text-neutral-mid" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Preparando los meses disponibles…
            </p>
          )}

          {importWindow.isError && (
            <QavanteInlineError
              error={importWindow.error}
              what="los meses disponibles"
              onRetry={() => void importWindow.refetch()}
            />
          )}

          {importWindow.data && (
            <div className="space-y-1">
              <label htmlFor="sii-import-month" className="text-sm font-medium text-neutral-dark">
                Mes inicial
              </label>
              <input
                id="sii-import-month"
                type="month"
                value={monthValue(startDate)}
                min={monthValue(importWindow.data.earliest_start_date)}
                max={monthValue(importWindow.data.latest_start_date)}
                onChange={(event) => setStartDate(startDateForMonth(event.target.value))}
                className="flex h-10 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:border-brand-primary"
              />
              <p className="text-xs text-neutral-mid">Siempre usamos el día 1 del mes.</p>
            </div>
          )}

          {setImportWindow.isError && (
            <p className="text-xs text-danger-500" role="alert">
              No pudimos guardar el mes inicial. Intenta de nuevo antes de conectar el SII.
            </p>
          )}
        </section>

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
          continueLoading={save.isPending || setImportWindow.isPending}
          continueDisabled={!canSubmit}
          onSkip={connected ? () => router.push(NEXT) : handleDefer}
          skipLabel={connected ? "Continuar" : "Conectar después"}
        />
      </form>
    </OnboardingShell>
  );
}
