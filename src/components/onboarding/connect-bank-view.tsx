"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, Landmark, RefreshCw, ShieldCheck } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { SourceConsentCard } from "@/components/credenciales/source-consent-card";
import { LinkBankAccountsCard } from "@/components/treasury/link-bank-accounts-card";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useOnboardingSources } from "@/lib/api/onboarding-sources";
import { useSourceConsent, type ConsentMissingResponse } from "@/lib/api/source-consent";
import { BANK_SOURCE_CODE, useConnectBiceBank } from "@/lib/onboarding/connect-bank";
import { deferSource, undeferSource } from "@/lib/onboarding/deferred-sources";
import { isValidRut } from "@/lib/validators/rut";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";

/* Paso 4 — Conectar banco. Trae los movimientos bancarios para clasificarlos y
   proyectar caja. BICE se conecta por credenciales (RUT + clave de acceso, solo
   lectura, cifradas) MÁS la autorización legal de la fuente. Gated `onboarding`.

   Paso DIFERIBLE ("siempre wizard, con conexiones diferibles", 2026-08-12):
   "Conectar después" avanza y deja el banco pendiente en el hub de conexiones.

   ── Dos correcciones del review independiente del PR #935 ──────────────────

   1. HONESTIDAD DE ESTADO. El PUT responde 204 "guardadas" sin validar nada
      contra el banco, así que guardar la credencial NO es "Banco conectado". La
      verdad la da el backend (`steps.bank_connected`, que sale del estado
      canónico de la fuente). Mientras el backend no lo confirme, esta pantalla
      dice lo que de verdad pasó: "guardamos tus datos, falta confirmar".
   2. AUTORIZACIÓN. Sin consent la fuente queda `consent_missing` (= `error` en
      el estado canónico: header "Con errores" y caja `stale`) y
      `GET /api/bank-movements/bice/accounts` responde 403. Por eso el wizard
      pide la autorización EN ESTE PASO y no guarda la credencial sin ella: o el
      usuario autoriza, o difiere el paso y no se escribe nada. Ver el adaptador
      `src/lib/onboarding/connect-bank.ts` (contrato del qavante-api #955). */

const NEXT = routeAfter("connect-bank");

const BENEFITS = [
  { Icon: RefreshCw, text: "Traemos tus movimientos automáticamente, sin cargar nada a mano." },
  { Icon: ShieldCheck, text: "Conexión de solo lectura: nunca movemos tu plata." },
];

interface BankFormProps {
  rut: string;
  setRut: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  touched: boolean;
  rutValid: boolean;
}

/** Campos de acceso al banco. Se muestran SIEMPRE (también con el banco ya
 *  conectado, plegados): si el usuario tipeó mal la clave tiene que poder
 *  corregirla sin salir del wizard — el paso del SII ya lo permitía. */
function BankCredentialFields({
  rut,
  setRut,
  password,
  setPassword,
  touched,
  rutValid,
}: BankFormProps) {
  return (
    <>
      <div className="space-y-1">
        <label htmlFor="bice-rut" className="text-sm font-medium text-neutral-dark">
          RUT
        </label>
        <QavanteInput
          id="bice-rut"
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
        <label htmlFor="bice-clave" className="text-sm font-medium text-neutral-dark">
          Clave de acceso al banco
        </label>
        <PasswordInput
          id="bice-clave"
          placeholder="Tu clave del banco"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={touched && password.length < 4}
        />
      </div>
    </>
  );
}

export function ConnectBankView() {
  const router = useRouter();
  const save = useConnectBiceBank();
  const { states, refetch } = useOnboardingSources(true);
  const consent = useSourceConsent(BANK_SOURCE_CODE);
  const [rut, setRut] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);

  /* Verdad canónica del backend. `save.isSuccess` NO cuenta: el PUT solo guarda
     la credencial (204), no confirma que el banco esté conectado. */
  const connected = states.bank === "connected";
  const saved = save.isSuccess;

  const consentGranted = consent.data?.is_valid === true;
  const consentText = !consentGranted
    ? (consent.data as ConsentMissingResponse | undefined)?.consent_text_offered
    : undefined;
  /* Sin el texto legal no pedimos una aceptación: firmar algo que no mostramos
     no es consentimiento. Si el GET falla, el paso sigue siendo diferible. */
  const puedePedirConsent = Boolean(consentText);
  const necesitaConsent = !consentGranted;

  const rutValid = isValidRut(rut);
  // `!isPending` corta el doble-submit (Enter repetido antes de que React deshabilite).
  const canSubmit =
    rutValid &&
    password.length >= 4 &&
    !save.isPending &&
    (!necesitaConsent || (puedePedirConsent && accepted));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    /* Al conectar NO saltamos al paso siguiente: primero hay que confirmar el
       estado real y vincular las cuentas que trae BICE (si no, sus movimientos
       quedan en cuarentena). */
    save.mutate(
      { rut, password, acceptConsent: necesitaConsent },
      { onSuccess: () => undeferSource("bank") },
    );
  }

  /** "Conectar después": decisión explícita del usuario, no un descarte silencioso. */
  function handleDefer() {
    deferSource("bank");
    router.push(NEXT);
  }

  const description = connected
    ? "Tu banco quedó conectado. Vincula tus cuentas para que traigamos sus movimientos."
    : saved
      ? "Guardamos tus datos de acceso. Falta confirmar la conexión con el banco."
      : "Conecta tu banco para traer tus movimientos y proyectar tu caja.";

  return (
    <OnboardingShell step="connect-bank" description={description}>
      <div className="max-w-md space-y-5">
        {connected && (
          <div
            className="flex items-start gap-3 rounded-xl border border-success-500/30 bg-success-500/5 p-3 text-sm text-neutral-dark"
            role="status"
          >
            <CheckCircle2
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-success-600"
              aria-hidden="true"
            />
            <p>Banco conectado. Solo leemos tus movimientos; nunca movemos tu plata.</p>
          </div>
        )}

        {/* Guardado pero SIN confirmación del backend. No decimos "conectado":
            decimos exactamente en qué estamos, y damos la salida. */}
        {!connected && saved && (
          <div
            className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted p-3 text-sm text-neutral-dark"
            role="status"
          >
            <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-primary" aria-hidden="true" />
            <div className="space-y-2">
              <p>
                Guardamos tus datos de acceso. La primera sincronización con el banco corre en
                segundo plano, así que todavía no podemos confirmar la conexión. Hasta que la
                confirmemos no mostramos tus movimientos ni tu saldo (no los damos por cero).
              </p>
              <QavanteButton size="sm" variant="ghost" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Revisar de nuevo
              </QavanteButton>
            </div>
          </div>
        )}

        {/* Autorización pendiente con la credencial ya guardada: la salida
            visible al callejón sin salida que reportó el review. */}
        {!connected && saved && necesitaConsent && (
          <SourceConsentCard
            sourceCode={BANK_SOURCE_CODE}
            label="Autorización de acceso al banco"
          />
        )}

        {/* Cuentas por vincular (cuarentena). Solo con el banco confirmado: sin
            autorización este endpoint responde 403 y la card no puede afirmar nada. */}
        {connected && <LinkBankAccountsCard />}

        {connected && (
          <p className="text-xs text-neutral-mid">
            Si dejas una cuenta sin vincular, sus movimientos no aparecen en Qavante. Puedes
            vincularla más tarde desde <strong>Tus conexiones</strong>.
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {!connected && !saved && (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted p-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary-50">
                  <Landmark className="h-6 w-6 text-brand-primary" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-neutral-dark">Banco BICE</p>
                  <p className="text-xs text-neutral-mid">
                    Ingresa tus datos de acceso. Si prefieres, puedes hacerlo más tarde desde
                    Administración.
                  </p>
                </div>
              </div>

              <ul className="space-y-2">
                {BENEFITS.map(({ Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-neutral-dark">
                    <Icon
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary"
                      aria-hidden="true"
                    />
                    {text}
                  </li>
                ))}
              </ul>
            </>
          )}

          {connected || saved ? (
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium text-neutral-dark">
                ¿Necesitas corregir tus datos de acceso?
              </summary>
              <div className="mt-4 space-y-5">
                <BankCredentialFields
                  rut={rut}
                  setRut={setRut}
                  password={password}
                  setPassword={setPassword}
                  touched={touched}
                  rutValid={rutValid}
                />
                <QavanteButton
                  type="submit"
                  size="sm"
                  loading={save.isPending}
                  disabled={!canSubmit}
                >
                  Guardar datos nuevos
                </QavanteButton>
              </div>
            </details>
          ) : (
            <BankCredentialFields
              rut={rut}
              setRut={setRut}
              password={password}
              setPassword={setPassword}
              touched={touched}
              rutValid={rutValid}
            />
          )}

          {/* Autorización: se pide ANTES de guardar nada. Sin ella el backend
              deja la fuente en `consent_missing` (= error) y el banco no
              sincroniza; guardar "a medias" empeoraría lo que ve el usuario. */}
          {necesitaConsent && !connected && (
            <div className="space-y-2 rounded-xl border border-border bg-surface-muted p-3">
              <p className="text-sm font-medium text-neutral-dark">
                Autorización para acceder a tu banco
              </p>
              {consent.isLoading ? (
                <p className="text-xs text-neutral-mid">Cargando el texto de la autorización…</p>
              ) : puedePedirConsent ? (
                <>
                  <p className="rounded-lg border border-border bg-surface p-3 text-xs text-neutral-dark">
                    {consentText}
                  </p>
                  <label className="flex items-start gap-2 text-sm text-neutral-dark">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 flex-shrink-0 accent-brand-primary"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    <span>Autorizo a Qavante a acceder a mi banco en los términos de arriba.</span>
                  </label>
                  {touched && !accepted && (
                    <p className="text-xs text-danger-500" role="alert">
                      Necesitamos tu autorización para conectar el banco. Si prefieres, puedes
                      conectarlo después.
                    </p>
                  )}
                </>
              ) : (
                /* No pudimos leer el texto legal → no inventamos uno ni damos la
                   autorización por hecha. Se dice y se ofrece reintentar. */
                <div className="space-y-2 text-xs text-neutral-mid">
                  <p>
                    No pudimos cargar el texto de la autorización, así que todavía no podemos
                    conectar el banco. Puedes reintentar o conectarlo después.
                  </p>
                  <QavanteButton
                    size="sm"
                    variant="ghost"
                    loading={consent.isFetching}
                    onClick={() => consent.refetch()}
                  >
                    Reintentar
                  </QavanteButton>
                </div>
              )}
            </div>
          )}

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

          {!connected && !saved && (
            <p className="text-xs text-neutral-mid">
              ¿Prefieres hacerlo más tarde? Sigue sin problema: hasta que conectes el banco no vamos
              a mostrar tus movimientos ni tu saldo (no los damos por cero). Puedes conectarlo
              cuando quieras desde <strong>Tus conexiones</strong>.
            </p>
          )}

          {connected || saved ? (
            <OnboardingStepActions
              continueType="button"
              continueLabel="Continuar"
              onContinue={() => router.push(NEXT)}
            />
          ) : (
            <OnboardingStepActions
              continueType="submit"
              continueLabel="Conectar y continuar"
              continueLoading={save.isPending}
              continueDisabled={!canSubmit}
              onSkip={handleDefer}
              skipLabel="Conectar después"
            />
          )}
        </form>
      </div>
    </OnboardingShell>
  );
}
