import { Activity } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { InicioMvpView } from "@/components/inicio/inicio-mvp-view";
import { InicioEjecutivoView } from "@/components/inicio/inicio-ejecutivo-view";
import { InicioEjecutivoV2Live } from "@/components/inicio/v2/inicio-ejecutivo-v2-live";
import { FinancialPositionCard } from "@/components/inicio/financial-position-card";
import { HoyLive } from "@/components/inicio/v01/hoy-live";
import { DecisionBriefSlot } from "@/components/decision-brief/decision-brief-slot";

/* Inicio Ejecutivo (Sprint C8). **Server Component** (como gestion/cobrar/pagar):
   resuelve el flag en runtime del Worker leyendo `NEXT_PUBLIC_FF_*` vía la
   `[vars]` de wrangler.toml (lookup con key computada → Next.js NO lo inlinea →
   runtime). Un `"use client"` acá rompería el gating (el lookup daría undefined
   en el cliente → flag siempre OFF en navegación soft). Jerarquía:
   1. `dashboardSummary` ON → el dashboard completo (Pulso, caja, brecha,
      cobranza, pagos, resultado, 3 acciones) cableado a `GET /api/dashboard/
      summary` (ya expuesto por el backend, acepta cookie).
   2. `inicioMvp` ON → el MVP de perfil (saludo + /api/me), interino.
   3. Default OFF → QavanteEmpty informativo "Sprint C8". */
export default function InicioPage() {
  const {
    inicioMvp,
    dashboardSummary,
    financialDecisionHome,
    inicioEjecutivoV2,
    inicioWidgets,
    inicioAgenda,
    hoyV01,
    bankBalances,
    decisionBrief,
  } = resolveFeatureFlags();

  /* V01 · Hoy (rediseño Fase 2, issue #62) — gated por `hoyV01`, HOY APAGADO. Convive con el
     Inicio actual en vez de reemplazarlo: con el flag OFF nada de abajo cambia (cero regresión).
     Va ANTES del resto porque no es otra card del dashboard, es otra pantalla: tiene su propio
     titular ("Hoy") y su propia pregunta, así que tampoco hereda el header de Inicio Ejecutivo. */
  if (hoyV01) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-neutral-dark">Inicio</h1>
        </header>
        {decisionBrief && <DecisionBriefSlot surface="inicio" />}
        <HoyLive bankBalancesEnabled={bankBalances} suppressRecommendations={decisionBrief} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-gradient-brand text-2xl font-bold">Inicio Ejecutivo</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Cómo está mi empresa hoy?</p>
      </header>

      {decisionBrief && <DecisionBriefSlot surface="inicio" />}
      {!decisionBrief && financialDecisionHome && <FinancialPositionCard />}

      {inicioEjecutivoV2 ? (
        <InicioEjecutivoV2Live
          widgetsEnabled={inicioWidgets}
          agendaEnabled={inicioAgenda}
          suppressRecommendations={decisionBrief}
        />
      ) : dashboardSummary ? (
        <InicioEjecutivoView suppressRecommendations={decisionBrief} />
      ) : inicioMvp ? (
        <InicioMvpView />
      ) : (
        <QavanteEmpty
          icon={Activity}
          title="Inicio Ejecutivo"
          description="Aquí vas a ver una frase ejecutiva que resume el estado actual de tu empresa, tu Pulso Empresa, alertas prioritarias y próximas acciones. Muy pronto disponible."
        />
      )}
    </div>
  );
}
