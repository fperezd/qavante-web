"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useVerifyEmail, useResendVerification } from "@/lib/api/onboarding";
import { OnboardingShell } from "./onboarding-shell";
import { Turnstile } from "./turnstile";
import { createPendingSignupTenants } from "@/lib/onboarding/signup-extra-tenants";
import { routeAfter } from "./onboarding-steps";
import { useOnboardingBack } from "./use-onboarding-back";

/* Paso 2 del onboarding — Verificar email. Dos entradas:
   - Con `?token=` (link del correo): auto-verifica → al éxito el backend setea
     la cookie y seguimos al primer paso post-auth.
   - Sin token (recién vienes del signup, `?email=`): estado "te enviamos un
     correo" + reenviar. `verify-email` y `resend-verification` están en prod;
     el reenvío exige captcha (Turnstile). */

const NEXT_ROUTE = routeAfter("verify-email"); // /onboarding/plan
const TURNSTILE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export function VerifyEmailView() {
  const router = useRouter();
  const onBack = useOnboardingBack("verify-email");
  const params = useSearchParams();
  const token = params.get("token");
  const email = params.get("email");

  const { mutate: verifyEmail, isPending, isSuccess, isError, error, isIdle } = useVerifyEmail();
  const resend = useResendVerification();
  const autoVerifyToken = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!token) {
      autoVerifyToken.current = null;
      return;
    }
    if (autoVerifyToken.current === token) return;
    autoVerifyToken.current = token;
    verifyEmail({ token });
  }, [token, verifyEmail]);

  const retryVerify = React.useCallback(() => {
    if (!token) return;
    verifyEmail({ token });
  }, [token, verifyEmail]);

  // ── Con token: verificando / éxito / error ──────────────────────────────
  if (token) {
    if (isSuccess) {
      return (
        <OnboardingShell step="verify-email">
          <VerifyEmailSuccess onContinue={() => router.push(NEXT_ROUTE)} />
        </OnboardingShell>
      );
    }

    if (isError) {
      return (
        <OnboardingShell step="verify-email">
          <Centered>
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 text-sm text-danger-500"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <div className="text-left">
                <p className="font-medium">No pudimos verificar tu correo</p>
                <p className="mt-1">
                  {error instanceof ApiError
                    ? apiErrorToUserMessage(error)
                    : "El enlace es inválido o expiró. Pide uno nuevo."}
                </p>
              </div>
            </div>
            <QavanteButton variant="secondary" loading={isPending} onClick={retryVerify}>
              Reintentar con este enlace
            </QavanteButton>
            <ResendBlock email={email} resend={resend} />
            {onBack && (
              <QavanteButton type="button" variant="ghost" onClick={onBack}>
                Atrás
              </QavanteButton>
            )}
          </Centered>
        </OnboardingShell>
      );
    }

    if (isPending) {
      return (
        <OnboardingShell step="verify-email">
          <Centered>
            <Loader2 className="h-10 w-10 animate-spin text-brand-primary" aria-hidden="true" />
            <p className="text-sm text-neutral-mid" role="status">
              Verificando tu correo…
            </p>
          </Centered>
        </OnboardingShell>
      );
    }

    return (
      <OnboardingShell step="verify-email">
        <Centered>
          <p className="text-sm text-neutral-mid" role="status">
            {isIdle ? "Listo para verificar tu correo." : "Verificando tu correo…"}
          </p>
          <QavanteButton size="lg" loading={isPending} onClick={retryVerify}>
            Verificar ahora
          </QavanteButton>
        </Centered>
      </OnboardingShell>
    );
  }

  // ── Sin token: "te enviamos un correo" ──────────────────────────────────
  return (
    <OnboardingShell
      step="verify-email"
      description="Te enviamos un enlace de verificación. Ábrelo desde tu correo para continuar."
    >
      <Centered>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary-50">
          <Mail className="h-7 w-7 text-brand-primary" aria-hidden="true" />
        </span>
        <p className="text-sm text-neutral-dark">
          {email ? (
            <>
              Revisa <span className="font-medium">{email}</span> y haz clic en el enlace.
            </>
          ) : (
            "Revisa tu bandeja de entrada y haz clic en el enlace."
          )}
        </p>
        <ResendBlock email={email} resend={resend} />
        {onBack && (
          <QavanteButton type="button" variant="ghost" onClick={onBack}>
            Atrás
          </QavanteButton>
        )}
      </Centered>
    </OnboardingShell>
  );
}

function ResendBlock({
  email,
  resend,
}: {
  email: string | null;
  resend: ReturnType<typeof useResendVerification>;
}) {
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);

  if (!email) {
    return (
      <p className="text-sm text-neutral-mid">
        ¿No te llegó?{" "}
        <Link href="/registro" className="font-medium text-brand-primary hover:underline">
          Volver a crear la cuenta
        </Link>
      </p>
    );
  }
  if (resend.isSuccess) {
    return (
      <p className="text-sm text-success-700">
        Te reenviamos el correo. Revisa tu bandeja.
        {process.env.NEXT_PUBLIC_APP_ENV === "development" && (
          <>
            {" "}
            En local, el enlace nuevo también aparece en la terminal de la API (
            <code className="text-xs">auth_resend_verify_link_local</code>).
          </>
        )}
      </p>
    );
  }

  const captchaOk = !TURNSTILE_CONFIGURED || Boolean(captchaToken);
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Turnstile onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
      <QavanteButton
        variant="secondary"
        loading={resend.isPending}
        disabled={!captchaOk}
        onClick={() => resend.mutate({ email, captcha_token: captchaToken || "local-dev" })}
      >
        Reenviar correo
      </QavanteButton>
      {resend.isError && (
        <p className="text-xs text-danger-500" role="alert">
          No pudimos reenviar. Intenta en unos segundos.
        </p>
      )}
    </div>
  );
}

function VerifyEmailSuccess({ onContinue }: { onContinue: () => void }) {
  const [extraTenantsReady, setExtraTenantsReady] = React.useState(false);
  const [extraTenantsError, setExtraTenantsError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    createPendingSignupTenants()
      .catch(() => {
        if (!cancelled) setExtraTenantsError(true);
      })
      .finally(() => {
        if (!cancelled) setExtraTenantsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Centered>
      <CheckCircle2 className="h-12 w-12 text-success-600" aria-hidden="true" />
      <p className="text-sm text-neutral-dark">¡Tu correo quedó verificado!</p>
      {extraTenantsError && (
        <p className="text-xs text-warning-700" role="status">
          Algunas empresas extra no se crearon automáticamente. Puedes agregarlas después desde
          Administración.
        </p>
      )}
      <QavanteButton size="lg" disabled={!extraTenantsReady} onClick={onContinue}>
        {extraTenantsReady ? "Continuar" : "Preparando tus empresas…"}
      </QavanteButton>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-4 py-8 text-center">{children}</div>;
}
