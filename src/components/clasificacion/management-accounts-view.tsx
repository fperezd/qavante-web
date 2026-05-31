"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import {
  useManagementAccountsTree,
  useToggleManagementAccountActive,
  useToggleManagementAccountVisible,
} from "@/lib/api/management";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { ManagementAccountsTree } from "./management-accounts-tree";
import { toManagementAccountTreeRows } from "./adapters";

/* Editor de la estructura de gestión (addendum §14). Container ("página =
   contenedor"): resuelve el árbol + las mutaciones de toggle y monta el árbol
   presentacional. PR 1: activar/desactivar + mostrar/ocultar + incluir
   inactivas. Crear/editar/mover llegan en PRs siguientes. El backend impone
   el permiso de escritura (403 → copy del Anexo C.3). */

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
  const query = useManagementAccountsTree({ includeInactive });
  const toggleActive = useToggleManagementAccountActive();
  const toggleVisible = useToggleManagementAccountVisible();

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

  const rows = toManagementAccountTreeRows(query.data?.items ?? []);

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
          Activa, desactiva u oculta cuentas de tu estructura. Crear, editar y mover llegan pronto.
        </p>
        <label className="flex shrink-0 items-center gap-2 text-sm text-neutral-mid">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-light text-brand-primary"
          />
          Incluir inactivas
        </label>
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
        />
      )}
    </div>
  );
}
