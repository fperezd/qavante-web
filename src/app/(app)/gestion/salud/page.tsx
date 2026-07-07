import { HeartPulse, ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { SaludView } from "@/components/gestion/salud/salud-view";
import { saludApreton } from "@/components/gestion/salud/salud-fixtures";

/* Salud (PULSO + Health Score, ADR-0064). **Server Component** (como las otras
   pantallas gateadas): resuelve `saludScreen` en runtime del Worker.

   Flag OFF (default, prod) → QavanteEmpty "muy pronto". Flag ON (dev, override
   `NEXT_PUBLIC_FF_SALUD_SCREEN=true`) → la pantalla con DATOS DE EJEMPLO: la vista
   ya está lista (prototipo PR #476) pero el motor v2 del backend todavía no existe
   (qavante-api #492/#495). El cableado a datos reales + tipos generados es
   qavante-web #487. Por eso el banner deja claro que son datos de ejemplo. */
export default function SaludPage() {
  const { saludScreen } = resolveFeatureFlags();

  if (!saludScreen) {
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
          <h1 className="mt-2 text-2xl font-bold text-neutral-dark">Salud de tu empresa</h1>
          <p className="mt-1 text-sm text-neutral-mid">
            ¿Te alcanza la plata este mes y hacia dónde va tu empresa?
          </p>
        </header>
        <QavanteEmpty
          icon={HeartPulse}
          title="Salud de tu empresa"
          description="Aquí vas a ver tus dos lecturas en una sola pantalla: el Pulso (cómo viene la caja de este mes) y el Health Score (hacia dónde va tu empresa), con las causas y qué decisiones podés tomar. Muy pronto disponible."
        />
      </div>
    );
  }

  return (
    <div>
      <div
        role="note"
        className="mx-auto mb-4 flex max-w-[1180px] items-center gap-2 rounded-lg border border-warning-500/30 bg-warning-50 px-4 py-2.5 text-xs text-warning-700"
      >
        <Info className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        Vista previa con <b className="mx-1 font-semibold">datos de ejemplo</b> — el cálculo real
        llega cuando el motor esté listo (ADR-0064).
      </div>
      <SaludView model={saludApreton} />
    </div>
  );
}
