"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import {
  GoogleSignInButton,
  MicrosoftSignInButton,
} from "@/components/forms/oauth-sign-in-buttons";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { safeInternalPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().min(1, "Ingresa tu correo").email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormValues = z.infer<typeof schema>;

/** Login por correo + Google/Microsoft. Vive en `/login-correo` para no perderlo
 *  mientras `/login` vuelve a ser RUT + clave. */
export function LoginCorreoForm() {
  const searchParams = useSearchParams();
  const redirect = safeInternalPath(searchParams.get("redirect"));
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      await api.post("/api/auth/login", {
        body: { email: values.email.toLowerCase(), password: values.password },
        skipAuthRetry: true,
      });
      /* Navegación DURA (no `router.push`): tras setear la cookie de sesión, el
         middleware que gatea /inicio necesita re-evaluarse con la cookie fresca.
         Una navegación soft de Next no la toma de forma confiable (queda pensando
         o rebota a /login). Un full-load garantiza que middleware + Server
         Components lean la sesión nueva (mismo patrón que el selector de empresa). */
      window.location.assign(redirect);
      return; // dejamos el botón en "cargando" hasta que la página se recargue
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(apiErrorToUserMessage(err, "login-correo"));
      } else {
        setSubmitError("Error inesperado. Reintenta.");
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
      <div className="space-y-3">
        <GoogleSignInButton />
        <MicrosoftSignInButton />
      </div>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-border" />
        </div>
        <p className="relative flex justify-center text-xs text-neutral-mid">
          <span className="bg-surface px-2">o</span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-neutral-dark">
            Correo
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-mid"
              aria-hidden="true"
            />
            <input
              id="email"
              type="email"
              placeholder="tucorreo@empresa.cl"
              autoComplete="username"
              {...register("email")}
              aria-invalid={Boolean(errors.email) || undefined}
              className={cn(
                "flex h-10 w-full rounded-lg border bg-surface py-2 pr-3 pl-9 text-sm text-neutral-dark transition-colors",
                "placeholder:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:border-brand-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
                errors.email ? "border-danger-500" : "border-border-strong",
              )}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-danger-500" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-neutral-dark">
            Clave
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-mid"
              aria-hidden="true"
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              {...register("password")}
              aria-invalid={Boolean(errors.password) || undefined}
              className={cn(
                "flex h-10 w-full rounded-lg border bg-surface py-2 pr-10 pl-9 text-sm text-neutral-dark transition-colors",
                "placeholder:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:border-brand-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
                errors.password ? "border-danger-500" : "border-border-strong",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => (s ? false : true))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-mid hover:text-neutral-dark"
              aria-label={showPassword ? "Ocultar clave" : "Mostrar clave"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-danger-500" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {submitError && (
          <div
            role="alert"
            className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
          >
            {submitError}
          </div>
        )}

        <QavanteButton type="submit" loading={isSubmitting} className="w-full" size="lg">
          Iniciar sesión
        </QavanteButton>

        <p className="flex flex-col items-center gap-1 text-center text-sm text-neutral-mid">
          <Link href="/recuperar-clave" className="text-brand-primary hover:underline">
            ¿Olvidaste tu clave?
          </Link>
          <Link href="/registro" className="text-brand-primary hover:underline">
            ¿Usuario nuevo?
          </Link>
        </p>
      </form>
    </div>
  );
}
