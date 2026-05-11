"use client";

import { Settings } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";

export default function AdministracionPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Administración</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Cómo configuro mi equipo y mis fuentes?</p>
      </header>
      <QavanteEmpty
        icon={Settings}
        title="Administración — construcción en Sprint C0 (issues C0-14 y C0-15)"
        description="Acá vas a configurar usuarios y permisos del equipo, fuentes de datos conectadas (SII, BICE, Buk, TGR, Previred) y preferencias de la empresa. Por ahora podés ir a Usuarios desde el sidebar."
        cta={
          <QavanteButton size="sm" variant="ghost">
            Ver roadmap
          </QavanteButton>
        }
      />
    </div>
  );
}
