"use client";

import { ArrowDownToLine } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";

export default function CobrarPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Quién me debe y qué debo cobrar primero?</p>
      </header>
      <QavanteEmpty
        icon={ArrowDownToLine}
        title="Cobranza — construcción en Sprint C4"
        description="Acá vas a ver tus documentos por cobrar ordenados por prioridad, cobranza vencida, antigüedad de saldos y acciones sugeridas por cliente. Disponible al cerrar Sprint C4."
        cta={
          <QavanteButton size="sm" variant="ghost">
            Ver roadmap
          </QavanteButton>
        }
      />
    </div>
  );
}
