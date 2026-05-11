"use client";

import { ArrowUpFromLine } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";

export default function PagarPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Pagar</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Qué debo pagar y qué pagos son críticos?</p>
      </header>
      <QavanteEmpty
        icon={ArrowUpFromLine}
        title="Pagos — construcción en Sprint C4"
        description="Acá vas a ver tus pagos pendientes priorizados, pagos críticos por vencer, recordatorios y proveedores frecuentes. Disponible al cerrar Sprint C4."
        cta={
          <QavanteButton size="sm" variant="ghost">
            Ver roadmap
          </QavanteButton>
        }
      />
    </div>
  );
}
