"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useSignup } from "@/lib/api/onboarding";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { Turnstile } from "./turnstile";
import { signupFormSchema, type SignupFormValues } from "./signup-form-schema";

/* Paso 1 del onboarding — Crear cuenta. La 1ra persona (owner) crea su empresa
   (ADR-0017). Alineado al contrato real `SignupRequest` (owner_full_name,
   owner_rut, company_name, company_rut, email, password, captcha_token). El RUT
   de empresa es obligatorio en el form (producto), aunque el backend lo acepte opcional.
   Captcha Turnstile obligatorio (el backend es fail-closed). Al éxito el backend
   manda el correo y avanzamos a /verificar. Gated por `onboarding`. */

const TURNSTILE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export function SignupView() {
  const router = useRouter();
  const signup = useSignup();
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  /* El token de Turnstile es de un solo uso: tras un error de signup, el token
     ya está consumido → remontamos el widget (bump del key) para conseguir uno
     fresco y que el reintento no falle con captcha_failed. */
  const [captchaKey, setCaptchaKey] = React.useState(0);

  React.useEffect(() => {
    if (signup.isError) {
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    }
  }, [signup.isError]);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      ownerFullName: "",
      ownerRut: "",
      email: "",
      password: "",
      companyName: "",
      companyRut: "",
    },
    mode: "onBlur",
  });

  // Si Turnstile no está configurado (dev/test sin key), no bloqueamos el envío.
  const captchaOk = !TURNSTILE_CONFIGURED || Boolean(captchaToken);

  function onSubmit(values: SignupFormValues) {
    signup.mutate(
      {
        company_name: values.companyName,
        company_rut: values.companyRut.trim(),
        owner_full_name: values.ownerFullName,
        owner_rut: values.ownerRut,
        email: values.email,
        password: values.password,
        captcha_token: captchaToken ?? "",
      },
      {
        onSuccess: () => router.push(`/verificar?email=${encodeURIComponent(values.email)}`),
      },
    );
  }

  return (
    <OnboardingShell
      step="signup"
      description="Crea tu cuenta y la empresa que vas a gestionar. Sos el primer usuario (owner)."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md space-y-4">
        <Field id="su-name" label="Tu nombre" error={errors.ownerFullName?.message}>
          <Controller
            control={control}
            name="ownerFullName"
            render={({ field }) => (
              <QavanteInput
                id="su-name"
                placeholder="Fernando Pérez"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.ownerFullName)}
                autoComplete="name"
              />
            )}
          />
        </Field>

        <Field id="su-owner-rut" label="Tu RUT" error={errors.ownerRut?.message}>
          <Controller
            control={control}
            name="ownerRut"
            render={({ field }) => (
              <QavanteInput
                id="su-owner-rut"
                variant="rut"
                placeholder="12.345.678-5"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.ownerRut)}
              />
            )}
          />
        </Field>

        <Field id="su-email" label="Email" error={errors.email?.message}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <QavanteInput
                id="su-email"
                placeholder="vos@empresa.cl"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.email)}
                autoComplete="email"
                inputMode="email"
              />
            )}
          />
        </Field>

        <Field id="su-password" label="Clave" error={errors.password?.message}>
          <PasswordInput
            id="su-password"
            placeholder="Mínimo 8 caracteres"
            invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="su-company" label="Razón social" error={errors.companyName?.message}>
            <Controller
              control={control}
              name="companyName"
              render={({ field }) => (
                <QavanteInput
                  id="su-company"
                  placeholder="Tooxs SpA"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.companyName)}
                  autoComplete="organization"
                />
              )}
            />
          </Field>

          <Field id="su-company-rut" label="RUT de la empresa" error={errors.companyRut?.message}>
            <Controller
              control={control}
              name="companyRut"
              render={({ field }) => (
                <QavanteInput
                  id="su-company-rut"
                  variant="rut"
                  placeholder="76.123.456-0"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.companyRut)}
                />
              )}
            />
          </Field>
        </div>

        <Turnstile
          key={captchaKey}
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
        />

        {signup.isError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>
              {signup.error instanceof ApiError
                ? apiErrorToUserMessage(signup.error)
                : "No pudimos crear tu cuenta. Intenta nuevamente."}
            </p>
          </div>
        )}

        <OnboardingStepActions
          continueType="submit"
          continueLabel="Crear cuenta"
          continueLoading={isSubmitting || signup.isPending}
          continueDisabled={!captchaOk}
        />

        <p className="text-center text-sm text-neutral-mid">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-brand-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </OnboardingShell>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-dark">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-danger-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
