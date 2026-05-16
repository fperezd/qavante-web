"use client";

import * as React from "react";
import { QavanteInput } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { filterByQuery } from "./filter";
import type { ManagementAccountOption } from "./types";

/* Selector de "categoría de gestión" con árbol + búsqueda (addendum §20).
   PRESENTACIONAL PURO: recibe la lista aplanada del árbol (con `level` para
   indentar) por props; sin fetch. El backend ya expone
   `/api/management/accounts/tree` (reconciliation P4-1) — el cableado real va
   en el PR de integración. Nodos `selectable: false` se muestran pero no se
   pueden elegir (categoría inactiva, addendum §14.4). */

export interface ManagementAccountSelectProps {
  items: ManagementAccountOption[];
  value?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  searchLabel?: string;
  placeholder?: string;
  id?: string;
}

export function ManagementAccountSelect({
  items,
  value,
  onChange,
  disabled,
  searchLabel = "Buscar categoría de gestión",
  placeholder = "Buscá una categoría…",
  id,
}: ManagementAccountSelectProps) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(
    () => filterByQuery(items, query, ["displayName"]),
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
          No encontramos una categoría de gestión con ese texto.
        </p>
      ) : (
        <ul aria-label="Categorías de gestión" className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.map((opt) => {
            const selected = opt.id === value;
            const selectable = opt.selectable !== false;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled={disabled || !selectable}
                  aria-pressed={selected}
                  onClick={() => onChange(opt.id)}
                  style={{ paddingLeft: `${0.75 + opt.level * 1}rem` }}
                  className={cn(
                    "flex w-full items-center rounded-md border py-2 pr-3 text-left text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    selected
                      ? "border-brand-primary bg-brand-primary-50 font-medium text-neutral-dark"
                      : "border-neutral-light text-neutral-dark hover:bg-brand-primary-50",
                  )}
                >
                  {opt.displayName}
                  {!selectable && <span className="ml-2 text-xs text-neutral-mid">(inactiva)</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
