"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, ListTree, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { QavanteEmpty, QavanteCard, QavanteBadge, QavanteButton } from "@/components/qavante";
import { useManagementDimensions, useUpdateDimension } from "@/lib/api/management";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { dimensionTypeLabel, dimensionRequirementLabel } from "./dimension-labels";
import { toManagementDimensionRows } from "./adapters";
import type { ManagementDimensionRow } from "./types";

/* Editor de vistas de gestión (dimensiones, addendum §15). Container: resuelve
   la lista + las mutaciones y monta las tarjetas. CRUD de dimensión: crear,
   editar y activar/desactivar (el activar va por PATCH `active`, no hay toggle
   dedicado). "Gestionar valores" abre el editor del ÁRBOL de valores de esa
   dimensión (drawer). El backend impone el permiso (403 → Anexo C.3).

   Dialogs/drawer lazy (form + zod solo al abrir): admin-only. */
const ManagementDimensionFormDialog = dynamic(
  () =>
    import("./management-dimension-form-dialog").then((m) => ({
      default: m.ManagementDimensionFormDialog,
    })),
  { ssr: false },
);
const DimensionValuesDrawer = dynamic(
  () => import("./dimension-values-drawer").then((m) => ({ default: m.DimensionValuesDrawer })),
  { ssr: false },
);

function LoadingSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-md bg-neutral-light/30" />
      ))}
    </div>
  );
}

export function ManagementDimensionsView() {
  const query = useManagementDimensions();
  const toggleActive = useUpdateDimension();
  const [formOpen, setFormOpen] = React.useState(false);
  /** Dimensión en edición; null = crear. Se conserva mientras anima al cerrar. */
  const [editing, setEditing] = React.useState<ManagementDimensionRow | null>(null);
  const [valuesOpen, setValuesOpen] = React.useState(false);
  const [valuesDimension, setValuesDimension] = React.useState<{ id: string; name: string } | null>(
    null,
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(row: ManagementDimensionRow) {
    setEditing(row);
    setFormOpen(true);
  }
  function openValues(row: ManagementDimensionRow) {
    setValuesDimension({ id: row.id, name: row.name });
    setValuesOpen(true);
  }

  if (query.isLoading) return <LoadingSkeleton />;

  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? apiErrorToUserMessage(query.error)
        : "No pudimos cargar las vistas de gestión. Intenta nuevamente.";
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-md border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <div>
          <p className="font-medium">No pudimos cargar las vistas de gestión</p>
          <p className="mt-1 text-neutral-mid">{message}</p>
        </div>
      </div>
    );
  }

  const rows = toManagementDimensionRows(query.data?.items ?? []);
  /* `variables` de la mutación de activar en curso = el accountId/dimensionId. */
  const pendingId = toggleActive.isPending ? toggleActive.variables?.dimensionId : undefined;
  const mutationError = toggleActive.error;

  const formDialog = (
    <ManagementDimensionFormDialog open={formOpen} onOpenChange={setFormOpen} dimension={editing} />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-mid">
          Crea, edita o desactiva vistas para mirar tu negocio por proyecto, obra, local u otra
          variable.
        </p>
        <QavanteButton size="sm" onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva vista
        </QavanteButton>
      </div>

      {mutationError && (
        <div
          role="alert"
          className="rounded-md border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
        >
          {mutationError instanceof ApiError
            ? apiErrorToUserMessage(mutationError)
            : "No pudimos guardar el cambio. Intenta nuevamente."}
        </div>
      )}

      {rows.length === 0 ? (
        <QavanteEmpty
          title="Todavía no hay vistas de gestión"
          description="Las vistas te dejan mirar tu negocio por cliente, proyecto, obra, local u otra variable. Crea la primera con «Nueva vista»."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((dim) => {
            const busy = pendingId === dim.id;
            return (
              <li key={dim.id}>
                <QavanteCard
                  variant="bordered"
                  className={"h-full " + (!dim.active ? "opacity-60" : "")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-neutral-dark">{dim.name}</h3>
                    <div className="flex shrink-0 items-center gap-1">
                      <ActionButton
                        label={`Editar ${dim.name}`}
                        Icon={Pencil}
                        onClick={() => openEdit(dim)}
                        disabled={busy}
                      />
                      <ActionButton
                        label={dim.active ? `Desactivar ${dim.name}` : `Activar ${dim.name}`}
                        Icon={dim.active ? Power : PowerOff}
                        onClick={() =>
                          toggleActive.mutate({
                            dimensionId: dim.id,
                            body: { active: !dim.active },
                          })
                        }
                        disabled={busy}
                        danger={dim.active}
                      />
                    </div>
                  </div>
                  {dim.description && (
                    <p className="mt-1 text-sm text-neutral-mid">{dim.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!dim.active && <QavanteBadge variant="default">Inactiva</QavanteBadge>}
                    {dim.isSystem && <QavanteBadge variant="default">Sistema</QavanteBadge>}
                    <QavanteBadge variant={dim.isRequired ? "warning" : "default"}>
                      {dimensionRequirementLabel(dim.isRequired)}
                    </QavanteBadge>
                    <QavanteBadge variant="info">{dimensionTypeLabel(dim.dataType)}</QavanteBadge>
                  </div>
                  <div className="mt-3">
                    <QavanteButton
                      variant="ghost"
                      size="sm"
                      onClick={() => openValues(dim)}
                      disabled={busy}
                    >
                      <ListTree className="h-4 w-4" aria-hidden="true" />
                      Gestionar valores
                    </QavanteButton>
                  </div>
                </QavanteCard>
              </li>
            );
          })}
        </ul>
      )}

      {formDialog}
      <DimensionValuesDrawer
        dimension={valuesDimension}
        open={valuesOpen}
        onOpenChange={setValuesOpen}
      />
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  Icon: typeof Pencil;
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
      className={
        "rounded-md p-1.5 text-neutral-mid transition-colors hover:bg-brand-primary-50 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary " +
        "disabled:cursor-not-allowed disabled:opacity-40 " +
        (danger ? "hover:text-danger-500" : "hover:text-brand-primary")
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
