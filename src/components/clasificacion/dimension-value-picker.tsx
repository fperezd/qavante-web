"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DimensionValueOption } from "./types";

/* Selector de valores de una "vista de gestión" (addendum §20).
   PRESENTACIONAL PURO. Respeta `allowsMultiple` (addendum §15.5 / §26.1:
   "DimensionValuePicker respeta allows_multiple_values"): si es false, la UI
   no permite multiselección (radios); si es true, checkboxes. Sin fetch —
   los valores llegan por props desde `/api/management/dimensions/{id}/values`
   en la integración real. */

export interface DimensionValuePickerProps {
  /** Nombre humano de la vista (ej. "Proyecto"). */
  dimensionName: string;
  values: DimensionValueOption[];
  /** Ids seleccionados. Con `allowsMultiple=false` se usa a lo sumo 1. */
  selected: string[];
  onChange: (selectedIds: string[]) => void;
  allowsMultiple?: boolean;
  disabled?: boolean;
}

export function DimensionValuePicker({
  dimensionName,
  values,
  selected,
  onChange,
  allowsMultiple = false,
  disabled,
}: DimensionValuePickerProps) {
  const groupName = React.useId();

  /* Solo multi: en single, seleccionar = onChange([id]); deseleccionar va por
     la opción "Sin asignar" (un radio ya `checked` NO dispara onChange al
     re-clickearlo → la rama toggle-off sería código muerto). */
  function toggleMultiple(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <fieldset disabled={disabled} className="space-y-1">
      <legend className="mb-1 text-sm font-medium text-neutral-dark">{dimensionName}</legend>
      {values.length === 0 ? (
        <p className="px-1 py-2 text-sm text-neutral-mid">Esta vista todavía no tiene valores.</p>
      ) : (
        <>
          {!allowsMultiple && (
            <label
              style={{ paddingLeft: "0.25rem" }}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                "hover:bg-brand-primary-50",
                selected.length === 0 ? "text-neutral-dark" : "text-neutral-mid",
              )}
            >
              <input
                type="radio"
                name={groupName}
                checked={selected.length === 0}
                onChange={() => onChange([])}
                className="h-4 w-4 accent-brand-primary"
              />
              <span className="italic">Sin asignar</span>
            </label>
          )}
          {values.map((v) => {
            const checked = selected.includes(v.id);
            return (
              <label
                key={v.id}
                style={{ paddingLeft: `${0.25 + v.level * 1}rem` }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  "hover:bg-brand-primary-50",
                  checked ? "text-neutral-dark" : "text-neutral-mid",
                )}
              >
                <input
                  type={allowsMultiple ? "checkbox" : "radio"}
                  name={allowsMultiple ? undefined : groupName}
                  checked={checked}
                  onChange={() => (allowsMultiple ? toggleMultiple(v.id) : onChange([v.id]))}
                  className="h-4 w-4 accent-brand-primary"
                />
                {v.label}
              </label>
            );
          })}
        </>
      )}
    </fieldset>
  );
}
