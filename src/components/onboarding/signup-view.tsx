"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useSignup, useSignupContribuyente } from "@/lib/api/onboarding";
import { isValidRut, normalizeRut } from "@/lib/validators/rut";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { Turnstile } from "./turnstile";
import { signupFormSchema, type SignupFormValues } from "./signup-form-schema";

/* Paso 1 del onboarding — Crear cuenta. La 1ra persona (owner) crea su empresa
   (ADR-0017). Alineado al contrato real `SignupRequest` (owner_full_name,
   owner_rut, company_name, company_rut, email, password, captcha_token). El RUT
   de empresa es obligatorio en el form (producto), aunque el backend lo acepte opcional.
   Al salir del RUT consultamos el SII (`getstc`) y rellenamos nombre / razón social.
   Captcha Turnstile obligatorio (el backend es fail-closed). Al éxito el backend
   manda el correo y avanzamos a /verificar. Gated por `onboarding`. */

const TURNSTILE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export function SignupView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthPrefill = searchParams.get("oauth") === "1";
  const prefillEmail = (searchParams.get("email") ?? "").trim();
  const prefillName = (searchParams.get("nombre") ?? "").trim();
  const signup = useSignup();
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  /* El token de Turnstile es de un solo uso: tras un error de signup, el token
     ya está consumido → remontamos el widget (bump del key) para conseguir uno
     fresco y que el reintento no falle con captcha_failed. */
  const [captchaKey, setCaptchaKey] = React.useState(0);
  const [ownerLookup, setOwnerLookup] = React.useState("");
  const [companyLookup, setCompanyLookup] = React.useState("");
  const [ownerAuto, setOwnerAuto] = React.useState(false);
  const [companyAuto, setCompanyAuto] = React.useState(false);

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
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      ownerFullName: prefillName,
      ownerRut: "",
      email: prefillEmail,
      password: "",
      passwordConfirmation: "",
      companyName: "",
      companyRut: "",
    },
    mode: "onBlur",
  });

  const ownerSii = useSignupContribuyente(ownerLookup, ownerLookup.length > 0);
  const companySii = useSignupContribuyente(companyLookup, companyLookup.length > 0);

  React.useEffect(() => {
    if (ownerSii.data?.status === "ok" && ownerSii.data.razon_social) {
      if (getValues("ownerFullName").trim() === "") {
        setValue("ownerFullName", ownerSii.data.razon_social, { shouldValidate: true });
        setOwnerAuto(true);
      }
    }
  }, [ownerSii.data, getValues, setValue]);

  React.useEffect(() => {
    if (companySii.data?.status === "ok" && companySii.data.razon_social) {
      if (getValues("companyName").trim() === "") {
        setValue("companyName", companySii.data.razon_social, { shouldValidate: true });
        setCompanyAuto(true);
      }
    }
  }, [companySii.data, getValues, setValue]);

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
        captcha_token: captchaToken || "local-dev",
      },
      {
        onSuccess: () => router.push(`/verificar?email=${encodeURIComponent(values.email)}`),
      },
    );
  }

  return (
    <OnboardingShell step="signup" description="Crea tu cuenta y la empresa que vas a gestionar.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md space-y-4">
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
                onValueChange={(v) => {
                  field.onChange(v);
                  setOwnerLookup("");
                  if (ownerAuto) {
                    setValue("ownerFullName", "");
                    setOwnerAuto(false);
                  }
                }}
                onBlur={() => {
                  field.onBlur();
                  if (isValidRut(field.value)) setOwnerLookup(normalizeRut(field.value));
                }}
                invalid={Boolean(errors.ownerRut)}
              />
            )}
          />
          <SiiHint
            fetching={ownerSii.isFetching}
            filled={ownerSii.data?.status === "ok" && Boolean(ownerSii.data.razon_social)}
            notFound={ownerLookup.length > 0 && ownerSii.data?.status === "not_found"}
            error={
              ownerLookup.length > 0 && (ownerSii.isError || ownerSii.data?.status === "error")
            }
            emptyLabel="Al ingresarlo traemos tu nombre del SII."
          />
        </Field>

        <Field id="su-name" label="Tu nombre" error={errors.ownerFullName?.message}>
          <Controller
            control={control}
            name="ownerFullName"
            render={({ field }) => (
              <QavanteInput
                id="su-name"
                placeholder="Juan González Carrasco"
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  setOwnerAuto(false);
                }}
                onBlur={field.onBlur}
                invalid={Boolean(errors.ownerFullName)}
                autoComplete="name"
              />
            )}
          />
        </Field>

        {oauthPrefill && (
          <p className="text-xs text-neutral-mid">
            Completá tu RUT y tu empresa. El correo viene de Google o Microsoft.
          </p>
        )}
        <Field id="su-email" label="Email" error={errors.email?.message}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <QavanteInput
                id="su-email"
                placeholder="tu@empresa.cl"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.email)}
                autoComplete="email"
                inputMode="email"
                readOnly={oauthPrefill}
              />
            )}
          />
        </Field>

        <Field id="su-password" label="Clave" error={errors.password?.message}>
          <PasswordInput
            id="su-password"
            placeholder="Mínimo 8 caracteres"
            invalid={Boolean(errors.password)}
            autoComplete="new-password"
            {...register("password")}
          />
        </Field>

        <Field
          id="su-password-confirm"
          label="Vuelve a ingresar la clave"
          error={errors.passwordConfirmation?.message}
        >
          <PasswordInput
            id="su-password-confirm"
            placeholder="Repite la clave"
            invalid={Boolean(errors.passwordConfirmation)}
            autoComplete="new-password"
            {...register("passwordConfirmation")}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  onValueChange={(v) => {
                    field.onChange(v);
                    setCompanyLookup("");
                    if (companyAuto) {
                      setValue("companyName", "");
                      setCompanyAuto(false);
                    }
                  }}
                  onBlur={() => {
                    field.onBlur();
                    if (isValidRut(field.value)) setCompanyLookup(normalizeRut(field.value));
                  }}
                  invalid={Boolean(errors.companyRut)}
                />
              )}
            />
            <SiiHint
              fetching={companySii.isFetching}
              filled={companySii.data?.status === "ok" && Boolean(companySii.data.razon_social)}
              notFound={companyLookup.length > 0 && companySii.data?.status === "not_found"}
              error={
                companyLookup.length > 0 &&
                (companySii.isError || companySii.data?.status === "error")
              }
              emptyLabel="Al ingresarlo traemos la razón social del SII."
            />
          </Field>

          <Field id="su-company" label="Razón social" error={errors.companyName?.message}>
            <Controller
              control={control}
              name="companyName"
              render={({ field }) => (
                <QavanteInput
                  id="su-company"
                  placeholder="Empresa SpA"
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    setCompanyAuto(false);
                  }}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.companyName)}
                  autoComplete="organization"
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

function SiiHint({
  fetching,
  filled,
  notFound,
  error,
  emptyLabel,
}: {
  fetching: boolean;
  filled: boolean;
  notFound: boolean;
  error: boolean;
  emptyLabel: string;
}) {
  return (
    <p className="min-h-4 text-xs">
      {fetching ? (
        <span className="inline-flex items-center gap-1 text-neutral-mid">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Buscando en el SII…
        </span>
      ) : filled ? (
        <span className="inline-flex items-center gap-1 text-success-700">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Datos traídos del SII
        </span>
      ) : error ? (
        <span className="text-warning-700">
          No pudimos consultar el SII. Ingresa el dato a mano.
        </span>
      ) : notFound ? (
        <span className="text-neutral-mid">No encontramos datos en el SII. Ingrésalo a mano.</span>
      ) : (
        <span className="text-neutral-mid">{emptyLabel}</span>
      )}
    </p>
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
