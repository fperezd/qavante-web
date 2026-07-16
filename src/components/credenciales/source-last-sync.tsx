"use client";

import { Clock } from "lucide-react";
import { useSourcesStatus } from "@/lib/api/sources-status";
import { formatDateTimeLike } from "@/lib/formatters/date";
import { ultimoSync } from "./source-last-sync-model";

/* Línea de "última sincronización" de una fuente. Reusable: banco (`bice`), SII (`sii_rcv`), etc.

   Solo afirma cuando sabe: si no pudimos preguntar (hoy `/api/sources/status` es api-key-only →
   401), no renderea nada en vez de mentir "Sin sincronizar todavía". La decisión vive en
   `source-last-sync-model.ts` (pura, con unit tests). */

export function SourceLastSync({ sourceCode }: { sourceCode: string }) {
  const { data, isLoading, isError } = useSourcesStatus();
  const r = ultimoSync({
    cargando: isLoading,
    error: isError,
    sources: data?.sources,
    sourceCode,
  });

  if (!r.mostrar) return null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-neutral-mid">
      <Clock className="h-3 w-3" aria-hidden="true" />
      {r.last ? (
        <>
          Última sincronización: <span className="tabular-nums">{formatDateTimeLike(r.last)}</span>
        </>
      ) : (
        "Sin sincronizar todavía"
      )}
    </p>
  );
}
