"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/observability/report-error";
import { QavanteButton } from "@/components/qavante";

/* Error boundary de segmento raíz (Tooxs Frontend Standard §17). Reporta vía el
   seam único y degrada con copy de recuperación + reintento. Client component
   por requerimiento de Next. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    reportError(error, { boundary: "root", digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-500/10 text-danger-500">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold text-neutral-dark">Algo salió mal</h1>
      <p className="max-w-md text-sm text-neutral-mid">
        Tuvimos un problema al mostrar esta página. Podés reintentar; si persiste, recargá.
      </p>
      <QavanteButton onClick={reset}>Reintentar</QavanteButton>
    </div>
  );
}
