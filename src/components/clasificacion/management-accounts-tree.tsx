"use client";

import * as React from "react";
import { Eye, EyeOff, Pencil, Plus, Power, PowerOff, type LucideIcon } from "lucide-react";
import { QavanteBadge, QavanteInput } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { filterByQuery } from "./filter";
import type { ManagementAccountTreeRow } from "./types";

/* Árbol EDITABLE de la estructura de gestión (addendum §14). PRESENTACIONAL
   PURO: recibe las filas aplanadas (con `level` para indentar) + callbacks de
   acción por props; sin fetch ni mutación propia (esas viven en el container
   `ManagementAccountsView`). Cada nodo expone activar/desactivar, mostrar/
   ocultar, crear sub-cuenta y editar. Mover llega en un PR siguiente. */

export interface ManagementAccountsTreeProps {
  rows: ManagementAccountTreeRow[];
  onToggleActive: (row: ManagementAccountTreeRow) => void;
  onToggleVisible: (row: ManagementAccountTreeRow) => void;
  /** Crear una sub-cuenta dentro del nodo. Si no se pasa, no se muestra. */
  onCreateChild?: (row: ManagementAccountTreeRow) => void;
  /** Editar el nodo (nombre/glosa/afecta-Pulso). Si no se pasa, no se muestra. */
  onEdit?: (row: ManagementAccountTreeRow) => void;
  /** Id del nodo cuya mutación está en curso → deshabilita sus acciones. */
  pendingId?: string | null;
}

export function ManagementAccountsTree({
  rows,
  onToggleActive,
  onToggleVisible,
  onCreateChild,
  onEdit,
  pendingId,
}: ManagementAccountsTreeProps) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => filterByQuery(rows, query, ["name", "code"]), [rows, query]);

  return (
    <div className="space-y-2">
      <QavanteInput
        value={query}
        onValueChange={setQuery}
        placeholder="Busca una cuenta…"
        aria-label="Buscar cuenta de gestión"
      />
      {filtered.length === 0 ? (
        <p className="px-1 py-3 text-sm text-neutral-mid">
          No encontramos una cuenta con ese texto.
        </p>
      ) : (
        <ul aria-label="Estructura de gestión" className="space-y-1">
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
                <span className="shrink-0 font-mono text-xs text-neutral-mid">{row.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-dark">
                  {row.name}
                </span>
                {!row.active && <QavanteBadge variant="default">Inactiva</QavanteBadge>}
                {row.active && !row.isVisible && (
                  <QavanteBadge variant="warning">Oculta</QavanteBadge>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {onEdit && (
                    <ActionButton
                      label={`Editar ${row.name}`}
                      Icon={Pencil}
                      onClick={() => onEdit(row)}
                      disabled={busy}
                    />
                  )}
                  {onCreateChild && row.active && (
                    <ActionButton
                      label={`Agregar sub-cuenta en ${row.name}`}
                      Icon={Plus}
                      onClick={() => onCreateChild(row)}
                      disabled={busy}
                    />
                  )}
                  <ActionButton
                    label={row.isVisible ? `Ocultar ${row.name}` : `Mostrar ${row.name}`}
                    Icon={row.isVisible ? Eye : EyeOff}
                    onClick={() => onToggleVisible(row)}
                    disabled={busy || !row.active}
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
