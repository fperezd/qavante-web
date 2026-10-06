"use client";

import { DataState } from "@/components/rediseno/data-state";
import { useDashboardSummary } from "@/lib/api/dashboard";
import { toFinancialDecisionReadScope, useFinancialScope } from "@/lib/api/financial-scope";
import { useSalud } from "@/lib/api/salud";
import { saludContratoModel } from "./salud-contrato-model";
import { SaludContratoView } from "./salud-contrato-view";

/* Cableado de la pantalla Salud al contrato canónico.

   El `as_of` sale del servidor (`generated_at` del resumen → `useFinancialScope`), nunca del
   reloj del browser: una fecha de corte puesta por el navegador cambia silenciosamente qué
   cifras entran. La sociedad y la moneda las resuelve el servidor por la misma vía.

   Esta pantalla NO está detrás de un flag. Un flag con default apagado que exige una variable
   de entorno y un redespliegue para prender significa, en la práctica, no entregar nada
   visible — ya pasó en este producto. Lo que el flag iba a proteger lo protege la pantalla
   sola: cuando el contrato no trae un instrumento, se dice con número cuánto cubre la lectura,
   sin fabricar un puntaje, sin mostrar un cero y sin pintar un color. */
export function SaludContratoLive() {
  const summary = useDashboardSummary();
  const financialScope = useFinancialScope(summary.data?.generated_at);
  const scope = toFinancialDecisionReadScope(financialScope.data);
  const salud = useSalud(scope);

  if (summary.isLoading || financialScope.isLoading || (scope && salud.isLoading)) {
    return (
      <DataState
        status="loading"
        what="la salud de tu empresa"
        hint="Estamos trayendo los puntajes del último corte y las partes que los componen. La lectura todavía no publica un tiempo estimado."
      />
    );
  }

  if (summary.isError) {
    return (
      <DataState
        status="error"
        what="el corte de tu empresa"
        cause="No pudimos confirmar la fecha de la información financiera para esta lectura."
        action={{ label: "Reintentar", onClick: () => void summary.refetch() }}
      />
    );
  }

  if (financialScope.isError || !scope) {
    return (
      <DataState
        status="error"
        what="la sociedad y la moneda de esta lectura"
        cause="No pudimos confirmar con qué sociedad y en qué moneda se mide tu salud financiera."
        action={{ label: "Reintentar", onClick: () => void financialScope.refetch() }}
      />
    );
  }

  if (salud.isError || !salud.data) {
    return (
      <DataState
        status="error"
        what="los puntajes de salud de tu empresa"
        cause="La lectura de salud no respondió. No mostramos puntajes ni clasificaciones mientras no podamos sostenerlos con su respaldo."
        action={{ label: "Reintentar", onClick: () => void salud.refetch() }}
      />
    );
  }

  return <SaludContratoView model={saludContratoModel(salud.data)} />;
}
