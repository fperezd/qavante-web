"use client";

import { AlertCircle } from "lucide-react";
import { QavanteEmpty, QavanteCard, QavanteBadge } from "@/components/qavante";
import { useManagementDimensions } from "@/lib/api/management";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { dimensionTypeLabel, dimensionRequirementLabel } from "./dimension-labels";

/* Vista read-only de las vistas de gestión (addendum §15, alcance mínimo:
   listar). El grid con editor de valores jerárquicos llega en un PR
   posterior. Patrón "página = contenedor" del repo (cf. estructura-gestión
   #122 / administracion/usuarios): el screen resuelve el flag (server) y
   monta esto (client) que hace el fetch + estados. Sin mutación. */

function LoadingSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-md bg-neutral-light/30" />
      ))}
    </div>
  );
}

export function ManagementDimensionsView() {
  const query = useManagementDimensions();

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

  const items = query.data?.items ?? [];

  if (items.length === 0) {
    return (
      <QavanteEmpty
        title="Todavía no hay vistas de gestión"
        description="Las vistas te dejan mirar tu negocio por cliente, proyecto, obra, local u otra variable. Vas a poder crearlas acá."
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((dim) => (
        <li key={dim.id}>
          <QavanteCard variant="bordered" className="h-full">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-dark">{dim.name}</h3>
              {!dim.active && <span className="text-xs text-neutral-mid">Inactiva</span>}
            </div>
            {dim.description && <p className="mt-1 text-sm text-neutral-mid">{dim.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <QavanteBadge variant={dim.is_required ? "warning" : "default"}>
                {dimensionRequirementLabel(dim.is_required)}
              </QavanteBadge>
              <QavanteBadge variant="info">{dimensionTypeLabel(dim.data_type)}</QavanteBadge>
            </div>
          </QavanteCard>
        </li>
      ))}
    </ul>
  );
}
