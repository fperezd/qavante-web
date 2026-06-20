"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { isValidRut } from "@/lib/validators/rut";
import { preservedCaret } from "./qavante-input-caret";

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
  const inputRef = React.useRef<HTMLInputElement>(null);
  /* Caret a restaurar tras un reformateo en vivo (currency/rut). null = nada
     pendiente; el layout effect lo aplica y vuelve a null. */
  const caretRef = React.useRef<number | null>(null);

  const current = value !== undefined ? value : internal;
  const showError =
    invalidProp ?? (variant === "rut" && touched && current !== "" && !isValidRut(current));

  /* #8: el input es controlado y reformatea en cada tecla → el browser manda
     el caret al final. Tras renderizar el valor nuevo, reanclamos el caret por
     cantidad de chars significativos. Solo si el input sigue enfocado (no
     pisar cambios programáticos del valor). */
  React.useLayoutEffect(() => {
    const el = inputRef.current;
    if (caretRef.current !== null && el && document.activeElement === el) {
      const pos = caretRef.current;
      el.setSelectionRange(pos, pos);
    }
    caretRef.current = null;
  });

  return (
    <input
      ref={inputRef}
      type={variantToType[variant]}
      value={current}
      aria-invalid={showError || undefined}
      onChange={(e) => {
        const raw = e.target.value;
        const rawCaret = e.target.selectionStart ?? raw.length;
        const transformed = transformByVariant(variant, raw);
        if (variant === "currency" || variant === "rut") {
          caretRef.current = preservedCaret(variant, raw, rawCaret, transformed);
        }
        if (value === undefined) setInternal(transformed);
        onValueChange?.(transformed);
      }}
      onBlur={(e) => {
        setTouched(true);
        onBlur?.(e);
      }}
      className={cn(
        "flex h-10 w-full rounded-lg border bg-surface px-3 py-2 text-sm text-neutral-dark transition-colors",
        "placeholder:text-neutral-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:border-brand-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        showError ? "border-danger-500" : "border-border-strong",
        className,
      )}
      {...props}
    />
  );
}
