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
import { routeAfter } from "./onboarding-steps";

/* Paso 2 del onboarding — Verificar email. Dos entradas:
   - Con `?token=` (link del correo): auto-verifica → al éxito el backend setea
     la cookie y seguimos al primer paso post-auth.
   - Sin token (recién venís del signup, `?email=`): estado "te enviamos un
     correo" + reenviar. FE-first: `POST /api/auth/verify-email` aún no existe. */

const NEXT_ROUTE = routeAfter("verify-email"); // /onboarding/conectar-sii

export function VerifyEmailView() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const email = params.get("email");

  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const triggered = React.useRef(false);

  // Auto-verificar una sola vez si llegó token.
  React.useEffect(() => {
    if (token && !triggered.current) {
      triggered.current = true;
      verify.mutate({ token });
    }
  }, [token, verify]);

  // ── Con token: verificando / éxito / error ──────────────────────────────
  if (token) {
    if (verify.isSuccess) {
      return (
        <OnboardingShell step="verify-email">
          <Centered>
            <CheckCircle2 className="h-12 w-12 text-success-600" aria-hidden="true" />
            <p className="text-sm text-neutral-dark">¡Tu correo quedó verificado!</p>
            <QavanteButton size="lg" onClick={() => router.push(NEXT_ROUTE)}>
              Continuar
            </QavanteButton>
          </Centered>
        </OnboardingShell>
      );
    }

    if (verify.isError) {
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
                  {verify.error instanceof ApiError
                    ? apiErrorToUserMessage(verify.error)
                    : "El enlace es inválido o expiró. Pedí uno nuevo."}
                </p>
              </div>
            </div>
            <ResendBlock email={email} resend={resend} />
          </Centered>
        </OnboardingShell>
      );
    }

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
              Revisá <span className="font-medium">{email}</span> y hacé clic en el enlace.
            </>
          ) : (
            "Revisá tu bandeja de entrada y hacé clic en el enlace."
          )}
        </p>
        <ResendBlock email={email} resend={resend} />
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
    return <p className="text-sm text-success-700">Te reenviamos el correo. Revisá tu bandeja.</p>;
  }
  return (
    <div className="space-y-1 text-center">
      <QavanteButton
        variant="secondary"
        loading={resend.isPending}
        onClick={() => resend.mutate({ email })}
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

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-4 py-8 text-center">{children}</div>;
}
