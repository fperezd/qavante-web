"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { isValidRut } from "@/lib/validators/rut";
import { cn } from "@/lib/utils";

const schema = z.object({
  rut: z.string().min(1, "RUT requerido").refine(isValidRut, "RUT inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/inicio";
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rut: "", password: "" },
    mode: "onBlur",
  });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      await api.post("/api/auth/login", {
        body: { rut: values.rut, password: values.password },
        skipAuthRetry: true,
      });
      router.push(redirect);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(apiErrorToUserMessage(err, "login"));
      } else {
        setSubmitError("Error inesperado. Reintenta.");
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label htmlFor="rut" className="text-sm font-medium text-neutral-dark">
            RUT
          </label>
          <Controller
            control={control}
            name="rut"
            render={({ field }) => (
              <QavanteInput
                id="rut"
                variant="rut"
                placeholder="12.345.678-9"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.rut)}
                autoComplete="username"
                autoFocus
              />
            )}
          />
          {errors.rut && (
            <p className="text-xs text-danger-500" role="alert">
              {errors.rut.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-neutral-dark">
            Clave
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              {...register("password")}
              aria-invalid={Boolean(errors.password) || undefined}
              className={cn(
                "flex h-10 w-full rounded-lg border bg-surface px-3 py-2 pr-10 text-sm text-neutral-dark transition-colors",
                "placeholder:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:border-brand-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
                errors.password ? "border-danger-500" : "border-border-strong",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
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
            className="rounded-md border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
          >
            {submitError}
          </div>
        )}

        <QavanteButton type="submit" loading={isSubmitting} className="w-full" size="lg">
          Iniciar sesión
        </QavanteButton>

        <p className="text-center text-sm text-neutral-mid">
          <Link href="/recuperar-clave" className="text-brand-primary hover:underline">
            ¿Olvidaste tu clave?
          </Link>
        </p>
      </form>
    </div>
  );
}
