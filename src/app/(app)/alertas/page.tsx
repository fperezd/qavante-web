import Link from "next/link";
import { Bell } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PulsoDetailView } from "@/components/gestion/pulso-detail-view";

/* Alertas reemplaza el nombre de "Pulso" en la UI. El motor backend
   (`/api/management/pulso`) se mantiene intacto en Fase 1. */
export default function AlertasPage() {
  const { pulsoDetail, pulsoObjetivo } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Alertas</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Qué requiere tu acción ahora?</p>
      </header>

      {pulsoDetail ? (
        <PulsoDetailView objetivoEnabled={pulsoObjetivo} />
      ) : (
        /* Ley 8: el vacío dice QUÉ pasa (no está habilitado), POR QUÉ (falta el cableado del
           motor en este ambiente) y ofrece una SALIDA — no describe una pantalla futura como
           si el usuario tuviera que esperar sin hacer nada. */
        <QavanteEmpty
          icon={Bell}
          title="Las alertas todavía no están habilitadas en esta empresa"
          description="El motor que las calcula no está encendido acá, así que no tenemos nada que mostrarte: preferimos decírtelo antes que mostrarte una lista vacía como si no tuvieras problemas. Mientras tanto, revisa que tus fuentes estén al día · casi todas las alertas salen de ahí."
          cta={
            <Link
              href="/conexiones"
              className="inline-flex items-center gap-1 rounded-md text-sm font-semibold text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Revisar mis conexiones
            </Link>
          }
        />
      )}
    </div>
  );
}
