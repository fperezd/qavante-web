"use client";

import { Activity } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";

export default function InicioPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Inicio Ejecutivo</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Cómo está mi empresa hoy?</p>
      </header>
      <QavanteEmpty
        icon={Activity}
        title="Inicio Ejecutivo — construcción en Sprint C8"
        description="Acá vas a ver una frase ejecutiva resumiendo el estado actual de tu empresa, tu Pulso Empresa, alertas prioritarias y próximas acciones. Disponible al cerrar Sprint C8."
        cta={
          <QavanteButton size="sm" variant="ghost">
            Ver roadmap
          </QavanteButton>
        }
      />
    </div>
  );
}
