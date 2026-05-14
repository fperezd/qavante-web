"use client";

/* QavanteInput omitea `type` así que no podemos pasarle type="password".
   Este wrapper raw es el mismo estilo visual con type=password real. Lo
   usamos en dialogs de credenciales SII + certificado donde queremos que
   el input enmascare el texto. */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  invalid?: boolean;
}

export function PasswordInput({ className, invalid, ...props }: PasswordInputProps) {
  return (
    <input
      type="password"
      autoComplete="new-password"
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-10 w-full rounded-md border bg-surface px-3 py-2 text-sm text-neutral-dark transition-colors",
        "placeholder:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid ? "border-danger-500" : "border-neutral-light",
        className,
      )}
      {...props}
    />
  );
}
