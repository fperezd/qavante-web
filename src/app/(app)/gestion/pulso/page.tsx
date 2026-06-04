import { Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PulsoDetailView } from "@/components/gestion/pulso-detail-view";

/* Pulso detalle (Sprint C6/C7, Maestro §7). **Server Component** (como las otras
   pantallas gateadas): resuelve `pulsoDetail` en runtime del Worker. Flag ON →
   el detalle del Pulso cableado a `GET /api/management/pulso` (contrato FE-first,
   gated hasta que el backend lo exponga). Default OFF → QavanteEmpty. */
export default function PulsoPage() {
  const { pulsoDetail } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/inicio"
          className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al inicio
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-dark">Pulso Empresa</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Por qué está así mi Pulso?</p>
      </header>

      {pulsoDetail ? (
        <PulsoDetailView />
      ) : (
        <QavanteEmpty
          icon={Activity}
          title="Pulso Empresa — construcción en Sprint C6/C7"
          description="Acá vas a ver tu índice de salud en detalle: qué lo compone, qué lo empuja arriba o abajo (drivers) y cómo evolucionó en el tiempo. Disponible al cerrar Sprint C6/C7."
        />
      )}
    </div>
  );
}
