"use client";

import { Clock } from "lucide-react";
import { useSourcesStatus } from "@/lib/api/sources-status";
import { formatDateTimeLike } from "@/lib/formatters/date";

/* Línea de "última sincronización" de una fuente. Lee `/api/sources/status` y
   muestra el `last_sync` de la fuente (DD-MM-AAAA HH:MM:SS) o "sin sincronizar".
   Reusable: banco (`bice`), SII (`sii_rcv`), etc. */

export function SourceLastSync({ sourceCode }: { sourceCode: string }) {
  const { data } = useSourcesStatus();
  const source = data?.sources?.find((s) => s.source === sourceCode);
  const last = source?.last_sync ?? null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-neutral-mid">
      <Clock className="h-3 w-3" aria-hidden="true" />
      {last ? (
        <>
          Última sincronización: <span className="tabular-nums">{formatDateTimeLike(last)}</span>
        </>
      ) : (
        "Sin sincronizar todavía"
      )}
    </p>
  );
}
