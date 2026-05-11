"use client";

import { Banknote } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";

export default function CajaPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Caja</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Me alcanza la caja y qué puedo hacer?</p>
      </header>
      <QavanteEmpty
        icon={Banknote}
        title="Caja proyectada — construcción en Sprint C3"
        description="Acá vas a ver tu flujo de caja a 13 semanas, brecha vs caja mínima, columnas obligatorias (cobros, pagos, sueldos, impuestos, deuda) y acciones recomendadas. Disponible al cerrar Sprint C3."
        cta={
          <QavanteButton size="sm" variant="ghost">
            Ver roadmap
          </QavanteButton>
        }
      />
    </div>
  );
}
