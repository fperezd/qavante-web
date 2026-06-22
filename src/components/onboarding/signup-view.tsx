"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useSignup } from "@/lib/api/onboarding";
import { OnboardingShell } from "./onboarding-shell";
import { signupFormSchema, type SignupFormValues } from "./signup-form-schema";

/* Paso 1 del onboarding — Crear cuenta. La 1ra persona crea su empresa (RUT) y
   queda owner (ADR-0017). FE-first: `POST /api/auth/signup` aún no existe; al
   éxito el backend manda el correo de verificación y avanzamos a /verificar.
   Gated por `onboarding` (la page lo resuelve). */

export function SignupView() {
  const router = useRouter();
  const signup = useSignup();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { name: "", email: "", password: "", companyName: "", companyRut: "" },
    mode: "onBlur",
  });

  function onSubmit(values: SignupFormValues) {
    signup.mutate(
      {
        name: values.name,
        email: values.email,
        password: values.password,
        company_name: values.companyName,
        company_rut: values.companyRut,
      },
      {
        onSuccess: () => {
          // Sin sesión todavía: hay que verificar el email. Pasamos el email a
          // /verificar para el estado "te enviamos un correo".
          router.push(`/verificar?email=${encodeURIComponent(values.email)}`);
        },
      },
    );
  }

  return (
    <OnboardingShell
      step="signup"
      description="Crea tu cuenta y la empresa que vas a gestionar. Sos el primer usuario (owner)."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md space-y-4">
        <Field id="su-name" label="Tu nombre" error={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <QavanteInput
                id="su-name"
                placeholder="Fernando Pérez"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.name)}
                autoComplete="name"
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

          <Field id="su-rut" label="RUT de la empresa" error={errors.companyRut?.message}>
            <Controller
              control={control}
              name="companyRut"
              render={({ field }) => (
                <QavanteInput
                  id="su-rut"
                  variant="rut"
                  placeholder="76.123.456-7"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.companyRut)}
                />
              )}
            />
          </Field>
        </div>

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

        <QavanteButton
          type="submit"
          size="lg"
          className="w-full"
          loading={isSubmitting || signup.isPending}
        >
          Crear cuenta
        </QavanteButton>

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
