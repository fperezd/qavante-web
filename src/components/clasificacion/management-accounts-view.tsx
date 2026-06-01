"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Plus } from "lucide-react";
import { QavanteButton, QavanteEmpty } from "@/components/qavante";
import {
  useManagementAccountsTree,
  useToggleManagementAccountActive,
  useToggleManagementAccountVisible,
} from "@/lib/api/management";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { ManagementAccountsTree } from "./management-accounts-tree";
import { toManagementAccountTreeRows } from "./adapters";
import { collectAccountDomains } from "./management-account-form-schema";
import type { ManagementAccountTreeRow } from "./types";

/* Editor de la estructura de gestión (addendum §14). Container ("página =
   contenedor"): resuelve el árbol + las mutaciones y monta el árbol
   presentacional. PR 1: activar/desactivar + mostrar/ocultar + incluir
   inactivas. PR 2: crear cuenta raíz + sub-cuenta. PR 3: editar
   (nombre/glosa/afecta-Pulso). Mover llega en un PR siguiente. El backend
   impone el permiso de escritura (403 → Anexo C.3).

   Los dialogs son lazy (form + zod solo al abrir): admin-only, no inflan el
   First Load JS de la pantalla read-mostly. */
const ManagementAccountCreateDialog = dynamic(
  () =>
    import("./management-account-create-dialog").then((m) => ({
      default: m.ManagementAccountCreateDialog,
    })),
  { ssr: false },
);
const ManagementAccountEditDialog = dynamic(
  () =>
    import("./management-account-edit-dialog").then((m) => ({
      default: m.ManagementAccountEditDialog,
    })),
  { ssr: false },
);

function LoadingSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-neutral-light/30" />
      ))}
    </div>
  );
}

export function ManagementAccountsView() {
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  /** Padre de la cuenta a crear: null = raíz; {id,name} = sub-cuenta. */
  const [createParent, setCreateParent] = React.useState<{ id: string; name: string } | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  /** Cuenta en edición; se conserva mientras el dialog anima al cerrar. */
  const [editAccount, setEditAccount] = React.useState<ManagementAccountTreeRow | null>(null);
  const query = useManagementAccountsTree({ includeInactive });
  const toggleActive = useToggleManagementAccountActive();
  const toggleVisible = useToggleManagementAccountVisible();

  function openCreate(parent: { id: string; name: string } | null) {
    setCreateParent(parent);
    setCreateOpen(true);
  }

  function openEdit(row: ManagementAccountTreeRow) {
    setEditAccount(row);
    setEditOpen(true);
  }

  if (query.isLoading) return <LoadingSkeleton />;

  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? apiErrorToUserMessage(query.error)
        : "No pudimos cargar la estructura de gestión. Intenta nuevamente.";
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-md border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <div>
          <p className="font-medium">No pudimos cargar la estructura de gestión</p>
          <p className="mt-1 text-neutral-mid">{message}</p>
        </div>
      </div>
    );
  }

  const items = query.data?.items ?? [];
  const rows = toManagementAccountTreeRows(items);
  const domains = collectAccountDomains(items);
  const createDialog = (
    <ManagementAccountCreateDialog
      open={createOpen}
      onOpenChange={setCreateOpen}
      parent={createParent}
      typeOptions={domains.types}
      destinationOptions={domains.destinations}
    />
  );
  const editDialog = (
    <ManagementAccountEditDialog open={editOpen} onOpenChange={setEditOpen} account={editAccount} />
  );

  if (rows.length === 0 && !includeInactive) {
    return (
      <QavanteEmpty
        title="Todavía no hay una estructura de gestión"
        description="Cuando configures tu estructura vas a poder verla y ajustarla acá, partiendo de una base sugerida."
      />
    );
  }

  /* `variables` de la mutación en curso = el accountId que se está toggleando. */
  const pendingId =
    (toggleActive.isPending ? toggleActive.variables : undefined) ??
    (toggleVisible.isPending ? toggleVisible.variables : undefined) ??
    null;
  const mutationError = toggleActive.error ?? toggleVisible.error;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-mid">
          Crea, edita, activa, desactiva u oculta cuentas de tu estructura. Mover llega pronto.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-neutral-mid">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-light text-brand-primary"
            />
            Incluir inactivas
          </label>
          <QavanteButton size="sm" onClick={() => openCreate(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva cuenta
          </QavanteButton>
        </div>
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
          title="No hay cuentas que mostrar"
          description="No hay cuentas inactivas para mostrar con el filtro actual."
        />
      ) : (
        <ManagementAccountsTree
          rows={rows}
          pendingId={pendingId}
          onToggleActive={(row) => toggleActive.mutate(row.id)}
          onToggleVisible={(row) => toggleVisible.mutate(row.id)}
          onCreateChild={(row: ManagementAccountTreeRow) =>
            openCreate({ id: row.id, name: row.name })
          }
          onEdit={openEdit}
        />
      )}

      {createDialog}
      {editDialog}
    </div>
  );
}
