"use client";

import * as React from "react";
import Link from "next/link";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { useSignupContribuyente } from "@/lib/api/onboarding";
import { isValidRut, normalizeRut } from "@/lib/validators/rut";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { saveSignupAccountDraft } from "./signup-draft";
import { signupAccountSchema, type SignupAccountValues } from "./signup-form-schema";
import {
  SignupField,
  SiiRazonSocialInputAssist,
  siiRazonSocialInputPadding,
} from "./signup-form-ui";

export function SignupView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthPrefill = searchParams.get("oauth") === "1";
  const prefillEmail = (searchParams.get("email") ?? "").trim();
  const prefillName = (searchParams.get("nombre") ?? "").trim();
  const [ownerLookup, setOwnerLookup] = React.useState("");
  const [ownerAuto, setOwnerAuto] = React.useState(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignupAccountValues>({
    resolver: zodResolver(signupAccountSchema),
    defaultValues: {
      ownerFullName: prefillName,
      ownerRut: "",
      email: prefillEmail,
      password: "",
      passwordConfirmation: "",
    },
    mode: "onBlur",
  });

  const ownerSii = useSignupContribuyente(ownerLookup, ownerLookup.length > 0);
  const ownerSiiFilled = ownerSii.data?.status === "ok" && Boolean(ownerSii.data.razon_social);
  const ownerSiiNotFound = ownerLookup.length > 0 && ownerSii.data?.status === "not_found";
  const ownerSiiError =
    ownerLookup.length > 0 && (ownerSii.isError || ownerSii.data?.status === "error");

  React.useEffect(() => {
    if (ownerSii.data?.status === "ok" && ownerSii.data.razon_social) {
      if (getValues("ownerFullName").trim() === "") {
        setValue("ownerFullName", ownerSii.data.razon_social, { shouldValidate: true });
        setOwnerAuto(true);
      }
    }
  }, [ownerSii.data, getValues, setValue]);

  function onSubmit(values: SignupAccountValues) {
    saveSignupAccountDraft(values);
    router.push("/registro/empresas");
  }

  return (
    <OnboardingShell step="signup" description="Crea tu cuenta de acceso a Qavante.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-md space-y-4">
        <SignupField id="su-owner-rut" label="Tu RUT" error={errors.ownerRut?.message}>
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
        </SignupField>

        <SignupField id="su-name" label="Tu nombre" error={errors.ownerFullName?.message}>
          <SiiRazonSocialInputAssist
            fetching={ownerSii.isFetching}
            filled={ownerSiiFilled}
            notFound={ownerSiiNotFound}
            error={ownerSiiError}
            tooltipText="Al ingresarlo traemos tu nombre del SII."
          >
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
                  className={siiRazonSocialInputPadding(ownerSii.isFetching || ownerSiiFilled)}
                />
              )}
            />
          </SiiRazonSocialInputAssist>
        </SignupField>

        {oauthPrefill && (
          <p className="text-xs text-neutral-mid">
            Completá tu RUT. El correo viene de Google o Microsoft.
          </p>
        )}

        <SignupField id="su-email" label="Email" error={errors.email?.message}>
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
        </SignupField>

        <SignupField id="su-password" label="Clave" error={errors.password?.message}>
          <PasswordInput
            id="su-password"
            placeholder="Mínimo 8 caracteres"
            invalid={Boolean(errors.password)}
            autoComplete="new-password"
            {...register("password")}
          />
        </SignupField>

        <SignupField
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
        </SignupField>

        <OnboardingStepActions
          continueType="submit"
          continueLabel="Continuar"
          continueLoading={isSubmitting}
        />

        <p className="text-center text-sm text-neutral-mid">
          ¿Ya tienes cuenta?{" "}
          <Link href={LOGIN_PATH} className="font-medium text-brand-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </OnboardingShell>
  );
}
