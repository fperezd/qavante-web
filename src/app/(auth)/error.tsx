"use client";

import * as React from "react";
import { reportError } from "@/lib/observability/report-error";
import { InlineError, QavanteButton } from "@/components/qavante";

/* Error boundary de auth (Tooxs Frontend Standard §17). Degrada dentro del panel
   del formulario, sin tumbar el layout. */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    reportError(error, { boundary: "auth", digest: error.digest });
  }, [error]);

  return (
    <div className="space-y-4">
      <InlineError message="No pudimos cargar esta pantalla. Intentá nuevamente." />
      <QavanteButton className="w-full" onClick={reset}>
        Reintentar
      </QavanteButton>
    </div>
  );
}
