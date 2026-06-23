"use client";

import * as React from "react";
import { reportError } from "@/lib/observability/report-error";
import { InlineError, QavanteButton } from "@/components/qavante";

/* Error boundary del wizard de onboarding (Tooxs Frontend Standard §17). */
export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    reportError(error, { boundary: "onboarding", digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-6">
      <InlineError message="No pudimos cargar este paso. Intentá nuevamente." />
      <QavanteButton onClick={reset}>Reintentar</QavanteButton>
    </div>
  );
}
