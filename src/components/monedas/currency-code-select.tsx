"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/api/currencies";

interface CurrencyCodeSelectProps {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  currencies: Currency[];
  /* Si se pasa, filtra el catálogo al tipo indicado (`fiat` para funcional /
     reporting; `indexed_unit` para unidad indexada). */
  filterType?: "fiat" | "indexed_unit";
  /* Códigos a ocultar (ej. funcional cuando se elige reporting). */
  excludeCodes?: string[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  allowEmpty?: boolean;
  "aria-label"?: string;
}

/* `<select>` nativo de moneda con styling Qavante (ADR-0010 — sin combobox).
   Recibe el catálogo por prop para evitar refetchear en cada instancia. */
export function CurrencyCodeSelect({
  id,
  value,
  onChange,
  currencies,
  filterType,
  excludeCodes,
  placeholder = "Seleccioná una moneda…",
  disabled,
  invalid,
  allowEmpty = false,
  ...props
}: CurrencyCodeSelectProps) {
  const options = React.useMemo(() => {
    let list = currencies.filter((c) => c.active);
    if (filterType) list = list.filter((c) => c.currency_type === filterType);
    if (excludeCodes?.length) list = list.filter((c) => !excludeCodes.includes(c.code));
    return list;
  }, [currencies, filterType, excludeCodes]);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-label={props["aria-label"]}
      className={cn(
        "flex h-10 w-full rounded-md border bg-surface px-3 py-2 text-sm text-neutral-dark",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid ? "border-danger-500" : "border-neutral-light",
      )}
    >
      {(value === "" || allowEmpty) && (
        <option value="" disabled={!allowEmpty}>
          {placeholder}
        </option>
      )}
      {options.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} · {c.name}
        </option>
      ))}
    </select>
  );
}
