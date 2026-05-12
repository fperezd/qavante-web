"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { isValidRut } from "@/lib/validators/rut";

type Variant = "text" | "number" | "currency" | "date" | "rut";

export interface QavanteInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "value"
> {
  variant?: Variant;
  value?: string;
  onValueChange?: (raw: string) => void;
  invalid?: boolean;
}

const variantToType: Record<Variant, React.HTMLInputTypeAttribute> = {
  text: "text",
  number: "number",
  currency: "text",
  date: "date",
  rut: "text",
};

function transformByVariant(variant: Variant, raw: string): string {
  if (variant === "currency") {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return formatClp(Number(digits));
  }
  if (variant === "rut") {
    return formatRut(raw);
  }
  return raw;
}

export function QavanteInput({
  className,
  variant = "text",
  value,
  onValueChange,
  invalid: invalidProp,
  onBlur,
  ...props
}: QavanteInputProps) {
  const [internal, setInternal] = React.useState(value ?? "");
  const [touched, setTouched] = React.useState(false);

  const current = value !== undefined ? value : internal;
  const showError =
    invalidProp ?? (variant === "rut" && touched && current !== "" && !isValidRut(current));

  return (
    <input
      type={variantToType[variant]}
      value={current}
      aria-invalid={showError || undefined}
      onChange={(e) => {
        const transformed = transformByVariant(variant, e.target.value);
        if (value === undefined) setInternal(transformed);
        onValueChange?.(transformed);
      }}
      onBlur={(e) => {
        setTouched(true);
        onBlur?.(e);
      }}
      className={cn(
        "flex h-10 w-full rounded-md border bg-surface px-3 py-2 text-sm text-neutral-dark transition-colors",
        "placeholder:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        showError ? "border-danger-500" : "border-neutral-light",
        className,
      )}
      {...props}
    />
  );
}
