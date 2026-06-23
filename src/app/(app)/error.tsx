"use client";

import * as React from "react";
import { reportError } from "@/lib/observability/report-error";
import { InlineError, QavanteButton } from "@/components/qavante";

/* Error boundary del área autenticada (Tooxs Frontend Standard §17). Degrada
   localmente (el shell sigue en pie) en vez de tumbar toda la app. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    reportError(error, { boundary: "app", digest: error.digest });
  }, [error]);

  return (
    <div className="space-y-4">
      <InlineError message="No pudimos cargar esta sección. Intentá nuevamente." />
      <QavanteButton variant="secondary" size="sm" onClick={reset}>
        Reintentar
      </QavanteButton>
    </div>
  );
}
