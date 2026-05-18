"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { useManagementAccountsTree } from "@/lib/api/management";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { ManagementAccountSelect } from "./management-account-select";
import { flattenManagementAccounts } from "./adapters";

/* Vista read-only de la estructura de gestión (addendum §14, alcance mínimo:
   navegar el árbol). El editor con CRUD/move llega en un PR posterior. Patrón
   "página = contenedor" del repo (cf. administracion/usuarios): el screen
   resuelve el flag (server) y monta esto (client) que hace el fetch + estados.
   Sin mutación: la selección es local (resaltado), no persiste. */

function LoadingSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-md bg-neutral-light/30" />
      ))}
    </div>
  );
}

export function ManagementAccountsView() {
  const query = useManagementAccountsTree();
  const [selected, setSelected] = React.useState<string>();

  if (query.isLoading) return <LoadingSkeleton />;

  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? apiErrorToUserMessage(query.error)
        : "No pudimos cargar la estructura de gestión. Intentá nuevamente.";
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

  const items = flattenManagementAccounts(query.data?.items ?? []);

  if (items.length === 0) {
    return (
      <QavanteEmpty
        title="Todavía no hay una estructura de gestión"
        description="Cuando configures tu estructura vas a poder verla y ajustarla acá, partiendo de una base sugerida."
      />
    );
  }

  return <ManagementAccountSelect items={items} value={selected} onChange={setSelected} />;
}
