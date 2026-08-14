"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Landmark, RefreshCw, ShieldCheck } from "lucide-react";
import { QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { LinkBankAccountsCard } from "@/components/treasury/link-bank-accounts-card";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { usePutBiceCredential } from "@/lib/api/bank-credentials";
import { useOnboardingSources } from "@/lib/api/onboarding-sources";
import { deferSource, undeferSource } from "@/lib/onboarding/deferred-sources";
import { isValidRut } from "@/lib/validators/rut";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";

/* Paso 4 — Conectar banco. Trae los movimientos bancarios para clasificarlos y
   proyectar caja. BICE se conecta por credenciales (RUT + clave de acceso) vía
   `PUT /api/credentials/bice` (solo lectura, cifradas). Gated por `onboarding`.

   Paso DIFERIBLE ("siempre wizard, con conexiones diferibles", 2026-08-12):
   "Conectar después" avanza y deja el banco pendiente en el hub de conexiones.

   Con el banco conectado el paso muestra las CUENTAS POR VINCULAR (contratos
   reales `GET /api/bank-movements/bice/accounts` +
   `POST /api/bank-movements/bice/accounts/{external_id}/link`): sin vincular, los
   movimientos quedan en cuarentena y la caja se vería vacía sin explicación. */

const NEXT = routeAfter("connect-bank");

const BENEFITS = [
  { Icon: RefreshCw, text: "Traemos tus movimientos automáticamente, sin cargar nada a mano." },
  { Icon: ShieldCheck, text: "Conexión de solo lectura: nunca movemos tu plata." },
];

export function ConnectBankView() {
  const router = useRouter();
  const save = usePutBiceCredential();
  const { states } = useOnboardingSources(true);
  const [rut, setRut] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  /* `save.isSuccess` = lo acaba de conectar en esta pantalla; `states.bank` = lo
     que confirma el backend (puede tardar en refrescar). Cualquiera de los dos
     habilita la vinculación de cuentas. */
  const connected = save.isSuccess || states.bank === "connected";

  const rutValid = isValidRut(rut);
  // `!isPending` corta el doble-submit (Enter repetido antes de que React deshabilite).
  const canSubmit = rutValid && password.length >= 4 && !save.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    /* Al conectar NO saltamos al paso siguiente: primero hay que vincular las
       cuentas que trae BICE (si no, sus movimientos quedan en cuarentena). */
    save.mutate({ rut, password }, { onSuccess: () => undeferSource("bank") });
  }

  /** "Conectar después": decisión explícita del usuario, no un descarte silencioso. */
  function handleDefer() {
    deferSource("bank");
    router.push(NEXT);
  }

  if (connected) {
    return (
      <OnboardingShell
        step="connect-bank"
        description="Tu banco quedó conectado. Vincula tus cuentas para que traigamos sus movimientos."
      >
        <div className="max-w-md space-y-5">
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

          {/* Cuentas por vincular (cuarentena). Degrada con gracia si el banco no
              responde: la card lo dice, no muestra ceros ni "todo listo". */}
          <LinkBankAccountsCard />

          <p className="text-xs text-neutral-mid">
            Si dejas una cuenta sin vincular, sus movimientos no aparecen en Qavante. Puedes
            vincularla más tarde desde <strong>Tus conexiones</strong>.
          </p>

          <OnboardingStepActions
            continueType="button"
            continueLabel="Continuar"
            onContinue={() => router.push(NEXT)}
          />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step="connect-bank"
      description="Conecta tu banco para traer tus movimientos y proyectar tu caja."
    >
      <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-5">
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

        <p className="text-xs text-neutral-mid">
          ¿Prefieres hacerlo más tarde? Sigue sin problema: hasta que conectes el banco no vamos a
          mostrar tus movimientos ni tu saldo (no los damos por cero). Puedes conectarlo cuando
          quieras desde <strong>Tus conexiones</strong>.
        </p>

        <OnboardingStepActions
          continueType="submit"
          continueLabel="Conectar y continuar"
          continueLoading={save.isPending}
          continueDisabled={!canSubmit}
          onSkip={handleDefer}
          skipLabel="Conectar después"
        />
      </form>
    </OnboardingShell>
  );
}
