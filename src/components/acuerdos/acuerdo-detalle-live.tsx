"use client";

import * as React from "react";
import { DataState } from "@/components/rediseno/data-state";
import { useMe } from "@/lib/api/users";
import { useFinancialAgreement, useTransitionFinancialAgreement } from "@/lib/api/financial-agreements";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { ApiError } from "@/lib/api/errors";
import { AcuerdoDetalleView, formalizeDraftToRequest, type FormalizeDraft } from "./acuerdo-detalle-view";

export function AcuerdoDetalleLive({ agreementId }: { agreementId: string }) {
  const me = useMe();
  const agreement = useFinancialAgreement(agreementId);
  const transition = useTransitionFinancialAgreement(agreementId);
  const [formalizeError, setFormalizeError] = React.useState<string | null>(null);

  if (agreement.isLoading || me.isLoading) {
    return <DataState status="loading" what="el acuerdo" />;
  }

  if (agreement.isError || !agreement.data) {
    return (
      <DataState
        status="error"
        what="este acuerdo"
        cause="La lectura del acuerdo no respondió."
        action={{ label: "Reintentar", onClick: () => void agreement.refetch() }}
      />
    );
  }

  if (me.isError || !me.data) {
    return (
      <DataState
        status="error"
        what="tu usuario"
        cause="No pudimos confirmar quién eres para registrar una formalización."
        action={{ label: "Reintentar", onClick: () => void me.refetch() }}
      />
    );
  }

  const responsibleUserId = me.data.user.id;

  function handleFormalize(draft: FormalizeDraft) {
    setFormalizeError(null);
    const idempotencyKey = `formalize-${agreementId}-${Date.now()}`;
    let request;
    try {
      request = formalizeDraftToRequest(draft, responsibleUserId, idempotencyKey);
    } catch {
      setFormalizeError("El calendario no quedó completo. Revisa fechas y montos.");
      return;
    }
    transition.mutate(
      request,
      {
        onError: (err) => {
          setFormalizeError(
            err instanceof ApiError ? apiErrorToUserMessage(err) : "No se pudo formalizar.",
          );
        },
      },
    );
  }

  return (
    <AcuerdoDetalleView
      agreement={agreement.data}
      onFormalize={handleFormalize}
      isFormalizing={transition.isPending}
      formalizeError={formalizeError}
    />
  );
}
