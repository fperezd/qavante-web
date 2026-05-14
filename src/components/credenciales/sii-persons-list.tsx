"use client";

import * as React from "react";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton, QavanteEmpty } from "@/components/qavante";
import { useDeletePersonCredentials, type SiiPersonStatus } from "@/lib/api/credentials";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatDateShortEsCL } from "./format";
import { SiiPersonDialog } from "./sii-person-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

interface Props {
  persons: SiiPersonStatus[];
}

export function SiiPersonsList({ persons }: Props) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [editPerson, setEditPerson] = React.useState<SiiPersonStatus | null>(null);
  const [deletePerson, setDeletePerson] = React.useState<SiiPersonStatus | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const del = useDeletePersonCredentials();

  async function confirmDelete() {
    if (!deletePerson) return;
    setDeleteError(null);
    try {
      await del.mutateAsync(deletePerson.rut);
      setDeletePerson(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? apiErrorToUserMessage(err) : "Error inesperado.");
    }
  }

  return (
    <>
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              <span>Personas autorizadas</span>
            </div>
            <QavanteButton size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Agregar
            </QavanteButton>
          </div>
        }
      >
        {persons.length === 0 ? (
          <QavanteEmpty
            icon={Users}
            title="Sin personas autorizadas todavía"
            description="Agregá al menos una persona (ej. tu contador) cuya clave SII Qavante pueda usar."
          />
        ) : (
          <ul className="divide-y divide-neutral-light/60">
            {persons.map((p) => (
              <li key={p.rut} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-dark">
                    {p.name ?? <span className="italic text-neutral-mid">Sin nombre</span>}
                  </p>
                  <p className="text-xs text-neutral-mid">
                    {p.rut}
                    {p.last_rotated_at && <> · Rotada {formatDateShortEsCL(p.last_rotated_at)}</>}
                  </p>
                </div>
                <QavanteBadge variant="success">Configurada</QavanteBadge>
                <div className="flex gap-1">
                  <QavanteButton size="sm" variant="ghost" onClick={() => setEditPerson(p)}>
                    Cambiar clave
                  </QavanteButton>
                  <QavanteButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletePerson(p)}
                    aria-label={`Eliminar credenciales de ${p.rut}`}
                  >
                    <Trash2 className="h-4 w-4 text-danger-500" aria-hidden="true" />
                  </QavanteButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </QavanteCard>

      <SiiPersonDialog open={addOpen} onOpenChange={setAddOpen} />
      <SiiPersonDialog
        open={Boolean(editPerson)}
        onOpenChange={(o) => !o && setEditPerson(null)}
        person={editPerson ?? undefined}
      />
      <DeleteConfirmDialog
        open={Boolean(deletePerson)}
        onOpenChange={(o) => {
          if (!o) {
            setDeletePerson(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar credenciales SII"
        description={
          deletePerson && (
            <>
              ¿Eliminar las credenciales SII de{" "}
              <strong>{deletePerson.name ?? deletePerson.rut}</strong>? Qavante no va a poder
              acceder al portal SII en su nombre hasta que las vuelvas a cargar.
            </>
          )
        }
        error={deleteError}
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
