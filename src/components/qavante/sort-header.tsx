import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/hooks/use-table-sort";

/* Cabecera de columna ordenable para las grillas (regla de producto: toda grilla
   con fechas/nombres/montos se ordena). Botón con la etiqueta + una flecha: ↑/↓
   cuando es la columna activa, ↕ tenue cuando no. Alinea a la derecha para montos.
   Se conecta al hook `useTableSort` (active = sortKey === key, dir = sortDir). */

export interface SortHeaderProps {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
  className?: string;
}

export function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
  className,
}: SortHeaderProps) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ordenar por ${label}${active ? (dir === "asc" ? " (ascendente)" : " (descendente)") : ""}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "group inline-flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 rounded",
        active ? "text-brand-primary" : "text-neutral-mid hover:text-neutral-dark",
        align === "right" && "flex-row-reverse",
        className,
      )}
    >
      {label}
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          active ? "text-brand-primary" : "text-neutral-light group-hover:text-neutral-mid",
        )}
        aria-hidden="true"
      />
    </button>
  );
}
