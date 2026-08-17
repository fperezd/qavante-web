"use client";

import { QavanteInlineError } from "@/components/qavante";
import { useReconciliationAliases } from "@/lib/api/reconciliation";
import { AliasesAprendidos } from "./aliases-aprendidos";

/** Contenedor read-only del diccionario de aliases aprendidos. */
export function AliasesAprendidosLive() {
  const aliases = useReconciliationAliases();

  if (aliases.isLoading) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <div className="h-5 w-64 animate-pulse rounded bg-neutral-light/40" />
        <div className="h-20 animate-pulse rounded-xl bg-neutral-light/30" />
        <span className="sr-only">Cargando patrones aprendidos…</span>
      </div>
    );
  }

  if (aliases.isError) {
    return (
      <QavanteInlineError
        error={aliases.error}
        what="los patrones aprendidos de conciliación"
        onRetry={() => aliases.refetch()}
      />
    );
  }

  return <AliasesAprendidos aliases={aliases.data?.items ?? []} />;
}
