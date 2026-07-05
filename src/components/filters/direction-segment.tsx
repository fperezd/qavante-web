"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, List } from "lucide-react";
import { cn } from "@/lib/utils";

/* Control segmentado de dirección para las pantallas de Caja: filtra los
   movimientos por flujo de dinero. Vocabulario de negocio (pedido de Fernando +
   handoff CC-API): `credit` = plata que ENTRA = "Cobrar"; `debit` = plata que
   SALE = "Pagar". Presentacional: recibe el valor y emite el nuevo.

   Se usa como filtro de primer nivel (visible siempre, no escondido en un panel)
   porque cobrar/pagar es el corte que el usuario hace más seguido. */

export type DirectionValue = "todos" | "credit" | "debit";

const OPTIONS: ReadonlyArray<{
  id: DirectionValue;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "todos", label: "Todos", icon: List },
  { id: "credit", label: "Cobrar", icon: ArrowDownLeft },
  { id: "debit", label: "Pagar", icon: ArrowUpRight },
];

export interface DirectionSegmentProps {
  value: DirectionValue;
  onChange: (value: DirectionValue) => void;
  /** Etiqueta accesible del grupo. */
  "aria-label"?: string;
}

export function DirectionSegment({
  value,
  onChange,
  "aria-label": ariaLabel = "Filtrar por dirección",
}: DirectionSegmentProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5"
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
              active
                ? "bg-surface text-neutral-dark shadow-sm"
                : "text-neutral-mid hover:text-neutral-dark",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                active && id === "credit" && "text-success-600",
                active && id === "debit" && "text-warning-600",
              )}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
