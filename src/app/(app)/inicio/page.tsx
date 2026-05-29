"use client";

import { Activity } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { InicioMvpView } from "@/components/inicio/inicio-mvp-view";

/* Landing del módulo Inicio. El Sprint C8 completo (Pulso Empresa,
   frase ejecutiva, alertas prioritarias, acciones recomendadas) llega
   cuando el backend exponga los endpoints — Fase 2 según addendum.

   MVP (flag `inicioMvp` ON): muestra saludo + perfil + tenant + último
   login consumiendo `/api/me`, único endpoint de info de usuario que
   acepta cookie auth hoy (ver Brecha 0 en
   docs/backend-contracts/c3-treasury-reports-gaps.md).

   Flag OFF (default): mantiene el QavanteEmpty informativo "Sprint C8". */
export default function InicioPage() {
  const { inicioMvp } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Inicio Ejecutivo</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Cómo está mi empresa hoy?</p>
      </header>

      {inicioMvp ? (
        <InicioMvpView />
      ) : (
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
      )}
    </div>
  );
}
