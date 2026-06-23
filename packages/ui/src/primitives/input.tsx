"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/* Input base agnóstico. Las máscaras de dominio (RUT chileno, moneda, etc.) se
   implementan en cada app sobre este primitivo. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(
        "h-10 w-full rounded-md border bg-surface px-3 text-sm text-neutral-dark outline-none transition-colors placeholder:text-neutral-mid focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1",
        error ? "border-danger-500" : "border-border",
        className,
      )}
      {...props}
    />
  );
});
