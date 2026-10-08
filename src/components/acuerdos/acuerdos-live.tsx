"use client";

import { DataState } from "@/components/rediseno/data-state";
import { useDashboardSummary } from "@/lib/api/dashboard";
import { useFinancialScope } from "@/lib/api/financial-scope";
import { useFinancialAgreements } from "@/lib/api/financial-agreements";
import { AcuerdosView } from "./acuerdos-view";

export function AcuerdosLive() {
  const summary = useDashboardSummary();
  const financialScope = useFinancialScope(summary.data?.generated_at);
  const legalEntityId = financialScope.data?.legal_entity_id ?? null;
  const agreements = useFinancialAgreements(legalEntityId);

  if (summary.isLoading || financialScope.isLoading) {
    return <DataState status="loading" what="acuerdos financieros" />;
  }

  if (summary.isError) {
    return (
      <DataState
        status="error"
        what="el corte de tu empresa"
        cause="No pudimos confirmar la fecha de la información financiera para esta consulta."
        action={{ label: "Reintentar", onClick: () => void summary.refetch() }}
      />
    );
  }

  if (financialScope.isError || !legalEntityId) {
    return (
      <DataState
        status="error"
        what="la entidad de esta lectura"
        cause="No pudimos confirmar la sociedad activa para consultar los acuerdos."
        action={{ label: "Reintentar", onClick: () => void financialScope.refetch() }}
      />
    );
  }

  if (agreements.isLoading) {
    return <DataState status="loading" what="acuerdos financieros" />;
  }

  if (agreements.isError || !agreements.data) {
    return (
      <DataState
        status="error"
        what="acuerdos financieros"
        cause="La lectura de acuerdos no respondió."
        action={{ label: "Reintentar", onClick: () => void agreements.refetch() }}
      />
    );
  }

  return <AcuerdosView items={agreements.data.items} />;
}
