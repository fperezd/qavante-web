"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { QavanteButton } from "@/components/qavante";
import { useAcceptInvitation } from "@/lib/api/users";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ["password_confirmation"],
    message: "Las claves no coinciden",
  });

type FormValues = z.infer<typeof schema>;

export function AceptarInvitacionForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const accept = useAcceptInvitation();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", password_confirmation: "" },
    mode: "onBlur",
  });

  if (!token) {
    return (
      <div className="rounded-lg bg-surface p-6 shadow-md">
        <h1 className="text-xl font-bold text-neutral-dark">Link incompleto</h1>
        <p className="mt-2 text-sm text-neutral-mid">
          El link no incluye un token de invitación válido. Pídele a un administrador que te invite
          de nuevo.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm text-brand-primary hover:underline"
        >
          Volver al login
        </Link>
      </div>
    );
  }

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      await accept.mutateAsync({
        token,
        password: values.password,
        password_confirmation: values.password_confirmation,
      });
      // Backend setea cookies de sesión, redirigimos a inicio
      router.push("/inicio");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "invitation_not_found") {
          setSubmitError("El enlace ya no es válido. Pídele a un admin que te invite de nuevo.");
        } else if (err.code === "invitation_expired") {
          setSubmitError("El enlace ya no es válido. Pídele a un admin que te invite de nuevo.");
        } else {
          setSubmitError(apiErrorToUserMessage(err));
        }
      } else {
        setSubmitError("Error inesperado. Reintenta.");
      }
    }
  }

  return (
    <div className="rounded-lg bg-surface p-6 shadow-md">
      <h1 className="text-xl font-bold text-neutral-dark">Crea tu clave</h1>
      <p className="mt-2 text-sm text-neutral-mid">
        Estás a un paso de unirte a la cuenta. Define una clave para entrar a Qavante.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <PasswordField
          id="aceptar-password"
          label="Nueva clave"
          name="password"
          control={control}
          error={errors.password?.message}
          show={showPassword}
          toggleShow={() => setShowPassword((s) => !s)}
          autoComplete="new-password"
        />

        <PasswordField
          id="aceptar-password-confirmation"
          label="Confirmar clave"
          name="password_confirmation"
          control={control}
          error={errors.password_confirmation?.message}
          show={showPassword}
          toggleShow={() => setShowPassword((s) => !s)}
          autoComplete="new-password"
        />

        {submitError && (
          <div
            role="alert"
            className="rounded-md border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
          >
            {submitError}
          </div>
        )}

        <QavanteButton type="submit" loading={isSubmitting} size="lg" className="w-full">
          Crear clave y entrar
        </QavanteButton>
      </form>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  name: "password" | "password_confirmation";
  control: ReturnType<typeof useForm<FormValues>>["control"];
  error?: string;
  show: boolean;
  toggleShow: () => void;
  autoComplete: string;
}

function PasswordField({
  id,
  label,
  name,
  control,
  error,
  show,
  toggleShow,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-dark">
        {label}
      </label>
      <div className="relative">
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <input
              id={id}
              type={show ? "text" : "password"}
              placeholder="••••••••"
              autoComplete={autoComplete}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={Boolean(error) || undefined}
              className={cn(
                "flex h-10 w-full rounded-md border bg-surface px-3 py-2 pr-10 text-sm text-neutral-dark",
                "placeholder:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                error ? "border-danger-500" : "border-neutral-light",
              )}
            />
          )}
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-mid hover:text-neutral-dark"
          aria-label={show ? "Ocultar clave" : "Mostrar clave"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p className="text-xs text-danger-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
