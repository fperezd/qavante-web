"use client";

import * as React from "react";
import { FolderInput, Pencil, Plus, Power, PowerOff, type LucideIcon } from "lucide-react";
import { QavanteBadge, QavanteInput } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { filterByQuery } from "./filter";
import type { DimensionValueTreeRow } from "./types";

/* Árbol EDITABLE de los valores de una dimensión (addendum §15.5).
   PRESENTACIONAL PURO: recibe las filas aplanadas (con `level` para indentar)
   + callbacks por props; sin fetch ni mutación (viven en el container
   `DimensionValuesDrawer`). Cada nodo expone editar, agregar sub-valor, mover
   y activar/desactivar. Mover = selector "Mover a…" (sin DnD, ADR-0009). */

export interface DimensionValuesTreeProps {
  rows: DimensionValueTreeRow[];
  onCreateChild: (row: DimensionValueTreeRow) => void;
  onEdit: (row: DimensionValueTreeRow) => void;
  onMove: (row: DimensionValueTreeRow) => void;
  onToggleActive: (row: DimensionValueTreeRow) => void;
  /** Id del nodo cuya mutación está en curso → deshabilita sus acciones. */
  pendingId?: string | null;
}

export function DimensionValuesTree({
  rows,
  onCreateChild,
  onEdit,
  onMove,
  onToggleActive,
  pendingId,
}: DimensionValuesTreeProps) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => filterByQuery(rows, query, ["name", "code"]), [rows, query]);

  return (
    <div className="space-y-2">
      <QavanteInput
        value={query}
        onValueChange={setQuery}
        placeholder="Busca un valor…"
        aria-label="Buscar valor"
      />
      {filtered.length === 0 ? (
        <p className="px-1 py-3 text-sm text-neutral-mid">No hay valores con ese texto.</p>
      ) : (
        <ul aria-label="Valores de la vista" className="space-y-1">
          {filtered.map((row) => {
            const busy = pendingId === row.id;
            return (
              <li
                key={row.id}
                style={{ marginLeft: `${row.level * 1}rem` }}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-neutral-light px-3 py-2",
                  !row.active && "opacity-60",
                )}
              >
                {row.code && (
                  <span className="shrink-0 font-mono text-xs text-neutral-mid">{row.code}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-dark">
                  {row.name}
                </span>
                {!row.active && <QavanteBadge variant="default">Inactivo</QavanteBadge>}
                <div className="flex shrink-0 items-center gap-1">
                  <ActionButton
                    label={`Editar ${row.name}`}
                    Icon={Pencil}
                    onClick={() => onEdit(row)}
                    disabled={busy}
                  />
                  {row.active && (
                    <ActionButton
                      label={`Agregar sub-valor en ${row.name}`}
                      Icon={Plus}
                      onClick={() => onCreateChild(row)}
                      disabled={busy}
                    />
                  )}
                  <ActionButton
                    label={`Mover ${row.name}`}
                    Icon={FolderInput}
                    onClick={() => onMove(row)}
                    disabled={busy}
                  />
                  <ActionButton
                    label={row.active ? `Desactivar ${row.name}` : `Activar ${row.name}`}
                    Icon={row.active ? Power : PowerOff}
                    onClick={() => onToggleActive(row)}
                    disabled={busy}
                    danger={row.active}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

function ActionButton({ label, Icon, onClick, disabled, danger }: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md p-1.5 text-neutral-mid transition-colors hover:bg-brand-primary-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        "disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "hover:text-danger-500" : "hover:text-brand-primary",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
