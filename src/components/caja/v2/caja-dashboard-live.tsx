"use client";

import * as React from "react";
import { ArrowLeftRight, Banknote, CheckCircle2, Globe, Inbox, TrendingUp } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { BankBalances } from "@/components/treasury/bank-balances/bank-balances";
import { CajaV2ResumenLive } from "./caja-v2-resumen-live";
import { CajaSubCard } from "../caja-sub-card";
import { CajaDashboardGrid } from "./caja-dashboard-grid";
import type { SortableWidgetItem } from "@/components/inicio/v2/sortable-widget-grid";

/* Landing de Caja como bloques REORDENABLES (piloto `cajaDashboard`). Compone las MISMAS secciones que la
   landing clásica (resumen/medidor, saldos, menú de movimientos, proyectada), cada una como un bloque
   movible/apagable en una columna. Client Component: los flags llegan resueltos desde la page. Con el flag
   OFF la page no monta esto → la Caja queda igual. */

export interface CajaDashboardLiveProps {
  cajaV2: boolean;
  cashFlowReport: boolean;
  cajaV3: boolean;
  bankBalances: boolean;
  bankMovementClassification: boolean;
  reconciliationReview: boolean;
}

export function CajaDashboardLive({
  cajaV2,
  cashFlowReport,
  cajaV3,
  bankBalances,
  bankMovementClassification,
  reconciliationReview,
}: CajaDashboardLiveProps) {
  const seccion = (titulo: string, contenido: React.ReactNode): React.ReactNode => (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-neutral-dark">{titulo}</h2>
      {contenido}
    </section>
  );

  const items: SortableWidgetItem[] = [];

  if (cajaV2 && cashFlowReport) {
    items.push({
      id: "resumen",
      label: "Resumen de caja",
      node: seccion("Resumen de caja", <CajaV2ResumenLive cajaV3={cajaV3} />),
    });
  }

  if (bankBalances) {
    items.push({
      id: "saldos",
      label: "Saldos en banco",
      node: seccion("Saldos en banco", <BankBalances />),
    });
  }

  if (bankMovementClassification) {
    items.push({
      id: "movimientos",
      label: "Movimientos bancarios",
      node: seccion(
        "Movimientos bancarios",
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CajaSubCard
            href="/caja/por-clasificar"
            icon={Inbox}
            title="Por clasificar"
            description="Movimientos pendientes de clasificación. Asigna categoría canónica y cuenta de gestión."
            badge="Acción pendiente"
            badgeVariant="warning"
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
              description="Movimientos que calzan con un documento pero sin certeza. Confirmalos de a un clic."
              badge="Acción pendiente"
              badgeVariant="warning"
            />
          )}
        </div>,
      ),
    });
  }

  // "Caja proyectada" solo si el resumen v2 NO encabeza (si no, es redundante con el medidor).
  if (!(cajaV2 && cashFlowReport)) {
    items.push({
      id: "proyectada",
      label: "Caja proyectada",
      node: cashFlowReport ? (
        seccion(
          "Caja proyectada",
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CajaSubCard
              href="/caja/proyeccion"
              icon={TrendingUp}
              title="Reporte de caja"
              description="Entradas y salidas agregadas por período. Default ≈13 semanas con granularidad semanal sobre la capa comprometida."
              badge="Proyección"
              badgeVariant="info"
            />
          </div>,
        )
      ) : (
        <QavanteEmpty
          icon={Banknote}
          title="Caja proyectada"
          description="Aquí vas a ver tu flujo de caja, la brecha frente a tu caja mínima, las columnas de cobros, pagos, sueldos, impuestos y deuda, y acciones recomendadas. Muy pronto disponible."
        />
      ),
    });
  }

  return <CajaDashboardGrid items={items} />;
}
