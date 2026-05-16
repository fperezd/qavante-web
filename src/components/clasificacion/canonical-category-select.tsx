"use client";

import * as React from "react";
import { QavanteInput, QavanteBadge } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { filterByQuery } from "./filter";
import type { CanonicalCategoryOption } from "./types";

/* Selector de "tipo de movimiento" (addendum §17.2 / §20). PRESENTACIONAL
   PURO: prop-driven, sin fetch ni estado de servidor. Solo estado UI local
   (query de búsqueda). Labels/descripciones vienen del backend
   (`CanonicalCategoryMeta`), nunca hardcodeados. Sin librería combobox nueva
   (decisión de dep aparte) — input de filtro + lista de botones accesible. */

const DIRECTION_TAG: Record<string, { text: string; variant: "success" | "danger" | "default" }> = {
  credit: { text: "Entra", variant: "success" },
  debit: { text: "Sale", variant: "danger" },
  any: { text: "Cualquiera", variant: "default" },
};

export interface CanonicalCategorySelectProps {
  items: CanonicalCategoryOption[];
  /** `code` seleccionado, o `undefined`. */
  value?: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** Label accesible del campo de búsqueda. */
  searchLabel?: string;
  placeholder?: string;
  id?: string;
}

export function CanonicalCategorySelect({
  items,
  value,
  onChange,
  disabled,
  searchLabel = "Buscar tipo de movimiento",
  placeholder = "Buscá un tipo de movimiento…",
  id,
}: CanonicalCategorySelectProps) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(
    () => filterByQuery(items, query, ["label", "description"]),
    [items, query],
  );

  return (
    <div className="space-y-2">
      <QavanteInput
        id={id}
        value={query}
        onValueChange={setQuery}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={searchLabel}
      />
      {filtered.length === 0 ? (
        <p className="px-1 py-3 text-sm text-neutral-mid">
          No encontramos un tipo de movimiento con ese texto.
        </p>
      ) : (
        <ul
          role="listbox"
          aria-label="Tipos de movimiento"
          className="max-h-72 space-y-1 overflow-y-auto"
        >
          {filtered.map((opt) => {
            const selected = opt.code === value;
            const tag = opt.expectedDirection ? DIRECTION_TAG[opt.expectedDirection] : undefined;
            return (
              <li key={opt.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(opt.code)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    selected
                      ? "border-brand-primary bg-brand-primary-50"
                      : "border-neutral-light hover:bg-brand-primary-50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-neutral-dark">{opt.label}</span>
                    {opt.description && (
                      <span className="mt-0.5 block text-xs text-neutral-mid">
                        {opt.description}
                      </span>
                    )}
                  </span>
                  {tag && <QavanteBadge variant={tag.variant}>{tag.text}</QavanteBadge>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
