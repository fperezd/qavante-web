"use client";

import { LineChart } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";

export default function GestionPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Gestión</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Estoy ganando o perdiendo operacionalmente?
        </p>
      </header>
      <QavanteEmpty
        icon={LineChart}
        title="Resultado Operacional — construcción en Sprint C5"
        description="Acá vas a ver tu Resultado Operacional de Gestión, drivers explicativos (qué cambió y por qué), Pulso Empresa detallado y comparativas mes a mes. Disponible al cerrar Sprint C5."
        cta={
          <QavanteButton size="sm" variant="ghost">
            Ver roadmap
          </QavanteButton>
        }
      />
    </div>
  );
}
