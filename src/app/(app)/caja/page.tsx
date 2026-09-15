import { ArrowLeftRight, Banknote, CheckCircle2, Globe, Inbox, TrendingUp } from "lucide-react";
import { FeatureUnavailableState, QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { BankBalances } from "@/components/treasury/bank-balances/bank-balances";
import { CajaV2ResumenLive } from "@/components/caja/v2/caja-v2-resumen-live";
import { CajaSubCard } from "@/components/caja/caja-sub-card";
import { CajaDashboardLive } from "@/components/caja/v2/caja-dashboard-live";
import { CajaV02Live } from "@/components/caja/v02/caja-v02-live";
import { DecisionBriefSlot } from "@/components/decision-brief/decision-brief-slot";

/* Landing del módulo Caja. Sprint C3 MVP cableó `/caja/proyeccion` con el
   reporte agregado de `/api/treasury/reports/cash-flow` — si el flag
   cashFlowReport está ON, mostramos un CTA card hacia esa pantalla. Si
   no, mantenemos el empty informativo "construcción en Sprint C3". Brecha
   vs caja mínima + acciones recomendadas quedan para wave 2 cuando el
   backend exponga los contratos. */
export default function CajaPage() {
  const {
    bankMovementClassification,
    cashFlowReport,
    bankBalances,
    reconciliationReview,
    cajaV2,
    cajaV3,
    cajaDashboard,
    cajaMarkCollected,
    cajaV02,
    decisionBrief,
  } = resolveFeatureFlags();

  /* V02 · Caja (rediseño Fase 2, issue #67) — gated por `cajaV02`, HOY ENCENDIDO en producción
     (`wrangler.toml`). Reemplaza la
     landing entera por la vista de la spec (una pantalla, una pregunta: "¿me alcanza la caja?").
     Con el flag apagado nada de abajo cambia (cero regresión). La auditoría de movimientos queda disponible
     como detalle secundario: no es el paso que responde si la caja alcanza. */
  if (cajaV02) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-neutral-dark">Caja</h1>
          <p className="mt-1 text-sm text-neutral-mid">¿Me alcanza la caja?</p>
        </header>
        {decisionBrief && <DecisionBriefSlot surface="caja" />}
        <CajaV02Live suppressRecommendations={decisionBrief} />
        {bankMovementClassification && (
          <section aria-labelledby="herramientas-section" className="space-y-3">
            <h2 id="herramientas-section" className="text-base font-semibold text-neutral-dark">
              Calidad y auditoría de movimientos
            </h2>
            <MovimientosSubCards reconciliationReview={reconciliationReview} />
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Caja</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Me alcanza la caja y qué puedo hacer?</p>
      </header>

      {decisionBrief && <DecisionBriefSlot surface="caja" />}

      {cajaDashboard ? (
        /* Piloto `cajaDashboard`: las mismas secciones, como bloques movibles/apagables (motor iPad). */
        <CajaDashboardLive
          cajaV2={cajaV2}
          cashFlowReport={cashFlowReport}
          cajaV3={cajaV3}
          bankBalances={bankBalances}
          bankMovementClassification={bankMovementClassification}
          reconciliationReview={reconciliationReview}
          markCollectedEnabled={cajaMarkCollected}
          suppressRecommendations={decisionBrief}
        />
      ) : (
        <>
          {/* Caja v2 (rediseño 2026-07-14): la respuesta de dueño + la curva de saldo encabezan la
              página (contestan el "¿me alcanza?" del título); las cards de abajo quedan como
              herramientas. Con `cajaV2` OFF o sin reporte de caja, la landing cae al menú clásico. */}
          {cajaV2 && cashFlowReport && (
            <CajaV2ResumenLive
              cajaV3={cajaV3}
              markCollectedEnabled={cajaMarkCollected}
              suppressRecommendations={decisionBrief}
            />
          )}

          {bankBalances && (
            <section aria-labelledby="saldos-section" className="space-y-3">
              <h2 id="saldos-section" className="text-base font-semibold text-neutral-dark">
                Saldos en banco
              </h2>
              <BankBalances />
            </section>
          )}

          {/* "Caja proyectada" como card sólo cuando el v2 NO encabeza (fallback): con el v2 arriba
              apunta a lo mismo (redundante), así que se omite. */}
          {!(cajaV2 && cashFlowReport) &&
            (cashFlowReport ? (
              <section aria-labelledby="proyeccion-section" className="space-y-3">
                <h2 id="proyeccion-section" className="text-base font-semibold text-neutral-dark">
                  Caja proyectada
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <CajaSubCard
                    href="/caja/proyeccion"
                    icon={TrendingUp}
                    title="Reporte de caja"
                    description="Entradas y salidas agregadas por período. Default ≈13 semanas con granularidad semanal sobre la capa comprometida."
                    badge="Proyección"
                    badgeVariant="info"
                  />
                </div>
              </section>
            ) : (
              <QavanteEmpty
                icon={Banknote}
                title="Caja proyectada"
                description="Aquí vas a ver tu flujo de caja, la brecha frente a tu caja mínima, las columnas de cobros, pagos, sueldos, impuestos y deuda, y acciones recomendadas. Muy pronto disponible."
              />
            ))}

          {bankMovementClassification ? (
            <section aria-labelledby="movimientos-section" className="space-y-3">
              <h2 id="movimientos-section" className="text-base font-semibold text-neutral-dark">
                Calidad y auditoría de movimientos
              </h2>
              <MovimientosSubCards reconciliationReview={reconciliationReview} />
            </section>
          ) : (
            <FeatureUnavailableState />
          )}
        </>
      )}
    </div>
  );
}

/* Auditoría de movimientos bancarios. Compartida por la landing clásica y por V02: conserva el
   acceso a revisar/reclasificar sin convertirlo en la acción principal de Caja. */
function MovimientosSubCards({ reconciliationReview }: { reconciliationReview: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <CajaSubCard
        href="/caja/por-clasificar"
        icon={Inbox}
        title="Movimientos pendientes"
        description="Movimientos sin categoría automática. Revísalos si necesitas mejorar el detalle de tus informes."
        badge="Calidad del dato"
        badgeVariant="info"
      />
      <CajaSubCard
        href="/caja/clasificados"
        icon={CheckCircle2}
        title="Clasificados"
        description="Auditoría de los ya clasificados. Filtra por categoría, dirección o período."
        badge="Auditoría"
        badgeVariant="success"
      />
      <CajaSubCard
        href="/caja/compras-extranjero"
        icon={Globe}
        title="Compras al extranjero"
        description="Compras en moneda extranjera de tus cartolas de tarjeta. Asigna concepto y categoría."
        badge="Tarjeta"
        badgeVariant="info"
      />
      {reconciliationReview && (
        <CajaSubCard
          href="/caja/conciliacion"
          icon={ArrowLeftRight}
          title="Conciliación"
          description="Audita los documentos propuestos para cada movimiento."
          badge="Auditoría"
          badgeVariant="info"
        />
      )}
    </div>
  );
}
